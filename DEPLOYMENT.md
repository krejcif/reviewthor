# Deployment Setup Guide

The CI/CD pipeline is ready but deployment is currently disabled. Follow this guide when you're ready to enable automatic deployment.

## 🚀 Quick Enable Checklist

- [ ] Set up Google Cloud service accounts
- [ ] Configure GitHub repository secrets
- [ ] Uncomment deployment jobs in CI workflow
- [ ] Test deployment manually first
- [ ] Enable automatic deployment

## Step 1: Google Cloud Setup

### Create Service Accounts

1. **Staging Service Account:**
   ```bash
   gcloud iam service-accounts create reviewthor-staging \
     --description="ReviewThor staging deployment" \
     --display-name="ReviewThor Staging"
   ```

2. **Production Service Account:**
   ```bash
   gcloud iam service-accounts create reviewthor-production \
     --description="ReviewThor production deployment" \
     --display-name="ReviewThor Production"
   ```

### Grant Permissions

```bash
# For staging
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:reviewthor-staging@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:reviewthor-staging@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# For production
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:reviewthor-production@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:reviewthor-production@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### Generate Key Files

```bash
# Staging key
gcloud iam service-accounts keys create staging-key.json \
  --iam-account=reviewthor-staging@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Production key
gcloud iam service-accounts keys create production-key.json \
  --iam-account=reviewthor-production@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## Step 2: GitHub Secrets Setup

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following repository secrets:

| Secret Name | Value |
|-------------|--------|
| `GCP_SA_KEY_STAGING` | Contents of `staging-key.json` file |
| `GCP_SA_KEY_PRODUCTION` | Contents of `production-key.json` file |
| `CODECOV_TOKEN` | *(Optional)* Your Codecov token |

## Step 3: Enable Deployment Jobs

Edit `.github/workflows/ci.yml`:

1. **Find this section:**
   ```yaml
   # TODO: Enable these deployment jobs when ready to deploy
   # deploy-staging:
   #   name: Deploy to Staging
   ```

2. **Remove all `#` comment symbols** from both `deploy-staging` and `deploy-production` jobs

3. **Remove the TODO comment line**

## Step 4: Test Deployment Manually

Before enabling automatic deployment, test manually:

```bash
# Test staging deployment
npm run build
npm run deploy:staging

# Test production deployment  
npm run deploy
```

## Step 5: GitHub Environments (Recommended)

1. Go to **Settings** → **Environments**
2. Create environments:
   - `staging`
   - `production`
3. Add protection rules for production:
   - Required reviewers
   - Wait timer
   - Restrict to specific branches

## Step 6: Enable Automatic Deployment

1. **Commit and push** the workflow changes
2. **Create a test branch** from `develop`
3. **Push to develop** → Should trigger staging deployment
4. **Merge to main** → Should trigger production deployment

## 🛡️ Security Best Practices

- [ ] Use separate Google Cloud projects for staging/production
- [ ] Enable audit logging for deployments
- [ ] Set up monitoring and alerting
- [ ] Use GitHub environment protection rules
- [ ] Rotate service account keys regularly
- [ ] Review deployment logs regularly

## 📋 Deployment Commands Reference

```bash
# Manual deployments
make deploy-stage    # Deploy to staging
make deploy          # Deploy to production

# Local testing
make start           # Test function locally
make ci-check        # Run all CI checks locally
```

## 🚨 Troubleshooting

### Common Issues

1. **"Permission denied" errors:**
   - Check service account permissions
   - Verify IAM roles are correctly assigned

2. **"Invalid credentials" errors:**
   - Ensure GitHub secrets contain valid JSON
   - Check service account key file format

3. **Function deployment fails:**
   - Verify project ID in gcloud commands
   - Check Cloud Functions API is enabled
   - Review function memory/timeout settings

### Getting Help

- Check GitHub Actions logs for detailed error messages
- Review Google Cloud Function logs in Cloud Console
- Test deployment manually first before enabling automation
- Verify all secrets are correctly configured

## 🎯 Ready to Deploy?

Once you've completed all steps:

1. The pipeline will automatically deploy to staging when you push to `develop`
2. The pipeline will automatically deploy to production when you push to `main`
3. All quality checks, security audits, and tests must pass before deployment

Your ReviewThor function will be available at the Cloud Function trigger URL!