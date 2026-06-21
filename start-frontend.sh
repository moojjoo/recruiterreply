# 1)
 cd /home/moojjoo/repos/recruiterreply/frontend

# 2) Rebuild image with the new nginx SPA config
docker build -t recruiterreply-frontend:latest .

# 3) Stop/remove old container if it exists
docker stop recruiterreply-frontend 2>/dev/null || true
docker rm recruiterreply-frontend 2>/dev/null || true

# 4) Run the updated container on port 8080
docker run -d --name recruiterreply-frontend -p 8080:80 recruiterreply-frontend:latest

# 5) Quick verify
curl -i http://localhost:8080/register | head
