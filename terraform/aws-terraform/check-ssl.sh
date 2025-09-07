#!/bin/bash

# SSL Certificate Validation Monitor
CERT_ARN="arn:aws:acm:us-west-2:147035159721:certificate/83396221-21c9-4e3a-aa8b-d0a1baa740ab"
REGION="us-west-2"

echo "🔍 Monitoring SSL certificate validation..."
echo "Certificate ARN: $CERT_ARN"
echo "Press Ctrl+C to stop monitoring"
echo ""

while true; do
    STATUS=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region "$REGION" --query 'Certificate.Status' --output text 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        TIMESTAMP=$(date '+%H:%M:%S')
        case $STATUS in
            "ISSUED")
                echo "✅ [$TIMESTAMP] Certificate VALIDATED! 🎉"
                echo ""
                echo "🚀 Ready to enable HTTPS. Run:"
                echo "   terraform apply -auto-approve"
                echo ""
                break
                ;;
            "PENDING_VALIDATION")
                echo "⏳ [$TIMESTAMP] Still waiting for validation..."
                ;;
            "FAILED")
                echo "❌ [$TIMESTAMP] Validation FAILED!"
                break
                ;;
            *)
                echo "⚠️  [$TIMESTAMP] Unknown status: $STATUS"
                ;;
        esac
    else
        echo "❌ [$TIMESTAMP] Error checking certificate status"
    fi
    
    sleep 10
done