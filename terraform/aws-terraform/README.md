# Webphone AWS Infrastructure

## Overview
This project has been successfully migrated from OCI to AWS. The infrastructure uses:
- **AWS Region**: us-west-2
- **Instance Type**: t4g.small (ARM Graviton)
- **Domain**: webphone.insightintelligence.io
- **SSL**: AWS Certificate Manager with auto-renewal

## Current Status
✅ **Infrastructure Deployed**: VPC, ALB, Auto Scaling, ECR  
✅ **Container Images**: Pushed to ECR  
✅ **DNS Validation**: Added to DNS provider and propagated  
✅ **HTTPS**: Certificate validated and HTTPS listener active! 🎉  
✅ **Instance Type**: Switched to t4g.small ARM Graviton for cost savings  
✅ **Migration Complete**: Ready for production use!  

## Quick Commands

### Check Infrastructure Status
```bash
cd /Users/donchiniquy/projects/insight-intelligence-webphone/terraform/aws-terraform
terraform output
```

### Apply Changes
```bash
terraform apply -auto-approve
```

### View Logs
```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/ec2"
```

## Key Outputs
- **Load Balancer**: `webphone-alb-1096969446.us-west-2.elb.amazonaws.com`
- **Backend ECR**: `147035159721.dkr.ecr.us-west-2.amazonaws.com/webphone/backend`
- **Frontend ECR**: `147035159721.dkr.ecr.us-west-2.amazonaws.com/webphone/frontend`

## DNS Configuration
**Validation Record** (already added):
```
_2640d59bbcc602d28c4f22d2bd26f48c.webphone.insightintelligence.io.
CNAME: _e36bb32fad862a24d26c75a3c8f52fcc.xlfgrmvvlj.acm-validations.aws.
```

**Domain Record** (to add):
```
webphone.insightintelligence.io
CNAME: webphone-alb-1096969446.us-west-2.elb.amazonaws.com
```

## Container Management

### Push New Images
```bash
# Login to ECR
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 147035159721.dkr.ecr.us-west-2.amazonaws.com

# Tag and push
docker tag your-backend:latest 147035159721.dkr.ecr.us-west-2.amazonaws.com/webphone/backend:latest
docker push 147035159721.dkr.ecr.us-west-2.amazonaws.com/webphone/backend:latest

docker tag your-frontend:latest 147035159721.dkr.ecr.us-west-2.amazonaws.com/webphone/frontend:latest
docker push 147035159721.dkr.ecr.us-west-2.amazonaws.com/webphone/frontend:latest
```

### Force Instance Refresh (after new images)
```bash
aws autoscaling start-instance-refresh --auto-scaling-group-name webphone-asg --region us-west-2
```

## Architecture
- **VPC**: 10.0.0.0/16
- **Public Subnets**: 10.0.1.0/24, 10.0.2.0/24 (ALB)
- **Private Subnets**: 10.0.10.0/24, 10.0.11.0/24 (App servers)
- **Auto Scaling**: 1-3 instances, desired: 2
- **Health Check**: `/health` endpoint

## Cost Estimate
- **t4g.small instances** (2): ~$15/month
- **Application Load Balancer**: ~$18/month  
- **NAT Gateway**: ~$32/month
- **Total**: ~$65-70/month

## Troubleshooting

### Check Certificate Status
```bash
# Quick status check
aws acm describe-certificate --certificate-arn "arn:aws:acm:us-west-2:147035159721:certificate/83396221-21c9-4e3a-aa8b-d0a1baa740ab" --region us-west-2 | jq '.Certificate.Status'

# Watch for validation (run until shows "ISSUED")
watch 'aws acm describe-certificate --certificate-arn "arn:aws:acm:us-west-2:147035159721:certificate/83396221-21c9-4e3a-aa8b-d0a1baa740ab" --region us-west-2 | jq ".Certificate.Status"'

# Once ISSUED, apply terraform to enable HTTPS
terraform apply -auto-approve
```

### View Instance Status
```bash
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names webphone-asg --region us-west-2
```

### Check Load Balancer Health
```bash
aws elbv2 describe-target-health --target-group-arn $(terraform output -raw load_balancer_dns_name)
```

## Migration History
**Previous**: OCI with SSL certificate issues and free tier limitations  
**Current**: AWS with working SSL certificates and reliable infrastructure  
**Migrated**: September 5, 2025  
**OCI Resources**: All destroyed ✅