# SSL Certificate Setup for webphone.insightintelligence.io

## Current Status
- Domain: webphone.insightintelligence.io points to Load Balancer IP: 137.131.2.242  
- HTTP working: http://137.131.2.242 and http://webphone.insightintelligence.io
- SSL Certificate: **Needs to be created manually in OCI Console**

## Step-by-Step Manual Certificate Creation

### 1. Create Certificate in OCI Console
1. Go to **OCI Console > Identity & Security > Certificates**
2. Click **Create Certificate**
3. Choose **"Let's Encrypt"** (free, automated) or **"Internal CA"** 
4. Fill in:
   - **Name**: `webphone-ssl-certificate`
   - **Domain**: `webphone.insightintelligence.io`
   - **Compartment**: Your main compartment
5. Click **Create Certificate**

### 2. Complete Domain Validation  
**For Let's Encrypt (Recommended):**
1. OCI will provide DNS TXT record details
2. Add the TXT record to your DNS (where webphone.insightintelligence.io is hosted)
3. Wait 5-10 minutes for validation to complete
4. Certificate status will change to "Active"

### 3. Add Certificate to Load Balancer
1. Go to **Networking > Load Balancers** 
2. Select the **webphone-lb** load balancer
3. Go to **Resources > Certificates**
4. Click **Add Certificate**
5. Select **"Import from Certificate Service"**
6. Choose the validated certificate from step 1-2
7. Click **Add Certificate**

### 4. Create HTTPS Listener
1. Still in Load Balancer, go to **Resources > Listeners**
2. Click **Create Listener**
3. Configure:
   - **Name**: `webphone-https-listener`
   - **Protocol**: `HTTP`
   - **Port**: `443`
   - **Backend Set**: `webphone-backend-set`
   - **Use SSL**: ✅ **Enabled**
   - **Certificate**: Select the imported certificate
4. Click **Create Listener**

### 5. Test HTTPS
- Test: `curl https://webphone.insightintelligence.io`
- Browser: https://webphone.insightintelligence.io (should show secure padlock)

## Alternative: Self-Signed for Testing
If you want to test immediately, you can use the scripts:
- `./create-self-signed-cert.sh` (creates test certificate)
- Then follow steps 3-4 above using "Import PEM" instead

## Architecture Notes
- Load Balancer: 2 subnets (10.0.6.0/24, 10.0.5.0/24) 
- Backend Server: Private subnet (10.0.2.36:80)
- Security: VCN-wide access (10.0.0.0/16) currently enabled