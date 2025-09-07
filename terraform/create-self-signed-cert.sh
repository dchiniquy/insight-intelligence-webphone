#!/bin/bash
# Create a self-signed SSL certificate for testing
# This will be replaced with Let's Encrypt later

set -e

DOMAIN="webphone.insightintelligence.io"
CERT_DIR="./ssl-certs"

echo "=== Creating Self-Signed Certificate for $DOMAIN ==="
echo "This is for testing only. We'll upgrade to Let's Encrypt after confirming SSL works."

# Create certificate directory
mkdir -p $CERT_DIR

# Generate private key
openssl genrsa -out "$CERT_DIR/private.pem" 2048

# Generate certificate signing request
openssl req -new -key "$CERT_DIR/private.pem" -out "$CERT_DIR/cert.csr" -subj "/CN=$DOMAIN"

# Generate self-signed certificate (valid for 90 days)
openssl x509 -req -in "$CERT_DIR/cert.csr" -signkey "$CERT_DIR/private.pem" -out "$CERT_DIR/certificate.pem" -days 90

# Create CA certificate (same as certificate for self-signed)
cp "$CERT_DIR/certificate.pem" "$CERT_DIR/ca.pem"

# Set proper permissions
chmod 600 "$CERT_DIR/private.pem"
chmod 644 "$CERT_DIR/certificate.pem" "$CERT_DIR/ca.pem"

echo "=== Self-Signed Certificate Created ==="
echo "Certificate: $CERT_DIR/certificate.pem"
echo "Private Key: $CERT_DIR/private.pem"
echo "CA Chain: $CERT_DIR/ca.pem"

# Create terraform variables file
cat > ssl-certificates.tfvars << EOF
# Self-signed SSL Certificate (for testing)
ssl_certificate = <<EOT
$(cat $CERT_DIR/certificate.pem)
EOT

ssl_private_key = <<EOT
$(cat $CERT_DIR/private.pem)
EOT

ssl_ca_certificate = <<EOT
$(cat $CERT_DIR/ca.pem)
EOT
EOF

echo ""
echo "Created ssl-certificates.tfvars with certificate contents."
echo ""
echo "⚠️  This is a SELF-SIGNED certificate - browsers will show warnings"
echo ""
echo "Next steps:"
echo "1. Run: terraform apply -var-file=ssl-certificates.tfvars"
echo "2. Test HTTPS: curl -k https://$DOMAIN (note the -k flag for self-signed)"
echo "3. Once SSL is working, we can upgrade to Let's Encrypt"

# Clean up CSR file
rm "$CERT_DIR/cert.csr"