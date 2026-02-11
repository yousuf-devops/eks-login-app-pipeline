# EKS Login Application

Login application deployed on AWS EKS with:
- AWS Secrets Store CSI Driver for secure credential management
- RDS MySQL database
- NGINX Ingress with sticky sessions
- Let's Encrypt SSL certificates

## Structure
- `kubernetes/` - Kubernetes manifests
- `application/` - Node.js application code
