pipeline {
    agent any

    tools {
        nodejs 'NODEJS_24'
    }

    options {
        disableConcurrentBuilds()
        timestamps()
    }

    parameters {
        string(name: 'APP_NAME', defaultValue: 'meterpulse', description: 'Name der Anwendung')
        booleanParam(name: 'DEPLOY', defaultValue: false, description: 'Soll die App deployed werden')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Build') {
            steps {
                sh '''
                    set -eu
                    npm run build
                    test -f dist/meter-pulse/browser/index.html
                    node -e '
                        const fs = require("node:fs");
                        fs.writeFileSync(
                            "dist/meter-pulse/browser/api-config.js",
                            "window.__APP_CONFIG__ = " + JSON.stringify({ apiBaseUrl: "" }) + ";",
                        );
                    '
                    tar -czf web.tar.gz -C dist/meter-pulse/browser .
                '''
            }
        }

        stage('Deploy') {
            when {
                expression { params.DEPLOY }
            }
            steps {
                sshagent(credentials: ["${DEPLOY_SSH_KEY}"]) {
                    sh '''
                        set -eu
                        : "${WEBSERVER_IP:?WEBSERVER_IP muss gesetzt sein}"
                        : "${SERVICE_API_URL:?SERVICE_API_URL muss für das Frontend-Deployment gesetzt sein}"
                        nginx_config=$(mktemp)
                        trap 'rm -f "$nginx_config"' EXIT
                        SERVICE_API_URL="$SERVICE_API_URL" NGINX_CONFIG_PATH="$nginx_config" node -e '
                            const fs = require("node:fs");
                            const url = new URL(process.env.SERVICE_API_URL);
                            if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
                                throw new Error("SERVICE_API_URL muss ein HTTP(S)-Ursprung ohne Pfad, Query oder Fragment sein.");
                            }
                            const template = fs.readFileSync("nginx/meterpulse.conf.template", "utf8");
                            fs.writeFileSync(process.env.NGINX_CONFIG_PATH, template.replace("__SERVICE_API_URL__", url.origin));
                        '
                        ssh_options="-o BatchMode=yes -o StrictHostKeyChecking=yes"
                        scp $ssh_options web.tar.gz "jenkins-deploy@${WEBSERVER_IP}:/tmp/meterpulse-web-${BUILD_NUMBER}.tar.gz"
                        scp $ssh_options "$nginx_config" "jenkins-deploy@${WEBSERVER_IP}:/tmp/meterpulse-nginx-${BUILD_NUMBER}.conf"

                        ssh $ssh_options "jenkins-deploy@${WEBSERVER_IP}" "bash -s -- '$BUILD_NUMBER' '$APP_NAME'" <<'REMOTE'
set -eu
build_number="$1"
appName="$2"
web_root="/var/www/${appName}"
web_archive="/tmp/meterpulse-web-${build_number}.tar.gz"
nginx_config="/tmp/meterpulse-nginx-${build_number}.conf"
nginx_site="/etc/nginx/sites-available/meterpulse"
nginx_backup="/tmp/meterpulse-nginx-${build_number}.backup"
trap 'rm -f "$web_archive" "$nginx_config"; sudo -n rm -f "$nginx_backup"' EXIT

sudo -n mkdir -p "$web_root"
sudo -n tar -xzf "$web_archive" -C "$web_root"
sudo -n chmod 755 -R "$web_root/"
sudo -n cp "$nginx_site" "$nginx_backup"
sudo -n install -m 644 "$nginx_config" "$nginx_site"
if ! sudo -n nginx -t; then
    sudo -n install -m 644 "$nginx_backup" "$nginx_site"
    exit 1
fi
sudo -n systemctl reload nginx
REMOTE
                    '''
                }
            }
        }
    }

    post {
        always {
            sh 'rm -f web.tar.gz'
        }
    }
}
