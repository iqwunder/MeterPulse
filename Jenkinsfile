pipeline {
    agent any

    tools {
        // Der Name muss exakt so heißen wie in der Global Tool Configuration eingetragen
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

        stage('Test') {
            steps {
                sh 'node --check server/index.js'
            }
        }

        stage('Build') {
            steps {
                withCredentials([string(credentialsId: 'meterpulse-database-url', variable: 'METERPULSE_DATABASE_URL')]) {
                    sh '''
                        set +x
                        set -eu
                        test -n "$METERPULSE_DATABASE_URL"
                        umask 077
                        printf 'DATABASE_URL=%s\n' "$METERPULSE_DATABASE_URL" > .env
                        npm run build
                        test -f dist/meter-pulse/browser/index.html
                        tar -czf web.tar.gz -C dist/meter-pulse/browser .
                        npm prune --omit=dev
                        tar -czf api.tar.gz server package.json package-lock.json node_modules .env
                    '''
                }
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
                        test -n "${WEBSERVER_IP}"
                        test -n jenkins-deploy
                        ssh_options="-o BatchMode=yes -o StrictHostKeyChecking=yes"
                        scp $ssh_options web.tar.gz api.tar.gz "jenkins-deploy@${WEBSERVER_IP}:/tmp/"

                        ssh $ssh_options "jenkins-deploy@${WEBSERVER_IP}" "bash -s -- '$BUILD_NUMBER' '$APP_NAME'" <<'REMOTE'
set -eu
build_number="$1"
appName="$2"
app_root=/opt/${appName}
web_root=/var/www/${appName}

tar -xzf "/tmp/api.tar.gz" -C "$app_root"
tar -xzf "/tmp/web.tar.gz" -C "$web_root"
sudo chmod 600 "$app_root/.env"
sudo chmod 755 -R "$app_root/"
sudo chmod 755 -R "$web_root/"

rm -f /tmp/api.tar.gz /tmp/web.tar.gz

sudo -n systemctl restart ${appName}-api
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 1 http://127.0.0.1:3010/api/health
REMOTE
                    '''
                }
            }
        }
    }

    post {
        always {
            sh 'rm -f .env web.tar.gz api.tar.gz'
        }
    }
}