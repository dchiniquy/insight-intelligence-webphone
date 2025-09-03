#!/bin/bash

# Setup OCI Object Storage backend for Terraform
# This script sets the required environment variables for HTTP backend authentication

echo "Setting up Terraform backend authentication..."

# Export environment variables for HTTP backend
export TF_HTTP_USERNAME="axoxnwhj7c1a/drchiniquy@gmail.com"
export TF_HTTP_PASSWORD=$(oci iam auth-token create --user-id ocid1.user.oc1..aaaaaaaadm6bhi7ha5cfrs4oifcmfpkrn3372splkgx4entzleqnzowskyua --description "Terraform Backend Auth Token" --query 'data.token' --raw-output 2>/dev/null || echo "MANUAL_TOKEN_NEEDED")

if [ "$TF_HTTP_PASSWORD" = "MANUAL_TOKEN_NEEDED" ]; then
    echo "❌ Auto token creation failed. You need to create an auth token manually:"
    echo ""
    echo "1. Go to OCI Console → Profile → User Settings"
    echo "2. Click 'Auth Tokens' in left menu"
    echo "3. Click 'Generate Token'"
    echo "4. Description: 'Terraform Backend'"
    echo "5. Copy the token and run:"
    echo "   export TF_HTTP_PASSWORD='your-token-here'"
    echo ""
    echo "Then run: terraform init -reconfigure"
    exit 1
else
    echo "✅ Auth token created successfully"
    echo ""
    echo "Backend authentication configured. You can now run:"
    echo "  terraform init -reconfigure"
fi