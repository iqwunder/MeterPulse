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
                    SERVICE_API_URL="$SERVICE_API_URL" node -e '
                        const fs = require("node:fs");
                        const value = process.env.SERVICE_API_URL || "";
                        let apiBaseUrl = "";
                        if (value) {
                            const url = new URL(value);
                            if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
                                throw new Error("SERVICE_API_URL muss ein HTTP(S)-Ursprung ohne Pfad, Query oder Fragment sein.");
                            }
                            apiBaseUrl = url.origin;
                        }
                        fs.writeFileSync(
                            "dist/meter-pulse/browser/api-config.js",
                            "window.__APP_CONFIG__ = " + JSON.stringify({ apiBaseUrl }) + ";",
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
                        ssh_options="-o BatchMode=yes -o StrictHostKeyChecking=yes"
                        scp $ssh_options web.tar.gz "jenkins-deploy@${WEBSERVER_IP}:/tmp/meterpulse-web-${BUILD_NUMBER}.tar.gz"

                        ssh $ssh_options "jenkins-deploy@${WEBSERVER_IP}" "bash -s -- '$BUILD_NUMBER' '$APP_NAME'" <<'REMOTE'
set -eu
build_number="$1"
appName="$2"
web_root="/var/www/${appName}"
web_archive="/tmp/meterpulse-web-${build_number}.tar.gz"
trap 'rm -f "$web_archive"' EXIT

sudo -n mkdir -p "$web_root"
sudo -n tar -xzf "$web_archive" -C "$web_root"
sudo -n chmod 755 -R "$web_root/"
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
