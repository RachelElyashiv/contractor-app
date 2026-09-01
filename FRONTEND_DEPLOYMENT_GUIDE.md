# 📱 Frontend Deployment Guide - Google Play Store

**Status:** Ready for Production  
**Platform:** Android via Google Play Store  
**Build System:** EAS (Expo Application Services)

---

## 🎯 Quick Start

This guide walks you through publishing the contractor-app to Google Play Store.

### Prerequisites
- ✅ Backend deployed to Google Cloud Run
- ✅ Backend API URL obtained
- ✅ Node.js 18+ installed
- ✅ EAS CLI installed: `npm install -g eas-cli`
- ✅ Expo account created: https://expo.dev
- ✅ Google Play Developer account created: https://play.google.com/console

---

## 🔧 Step 1: Configure Frontend

### 1.1 Update API URL

Create `.env.production` in the project root:

```env
# Backend API URL from Cloud Run deployment
EXPO_PUBLIC_API_URL=https://contractor-api-xxxxx.run.app
```

Or update `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://contractor-api-xxxxx.run.app"
    }
  }
}
```

### 1.2 Verify Configuration

```bash
# In your app code, verify the API URL loads
cd /path/to/contractor-app

# Check environment
echo $EXPO_PUBLIC_API_URL
```

---

## 📲 Step 2: Prepare Google Play Developer Account

### 2.1 Create App on Google Play Console

1. Go to https://play.google.com/console
2. Click **Create app**
3. Fill in app details:
   - **App name:** Contractor App (or your preferred name)
   - **Default language:** English
   - **App or game:** App
   - **Free or paid:** Free
   - **Content rating:** Complete questionnaire
   - **Target audience:** Contractors, construction professionals

### 2.2 Set Up Billing

1. Go to **Settings** → **Developer account** → **Payments profile**
2. Set up payment method (required to publish)
3. Create merchant account

### 2.3 Create Service Account for EAS

1. In Play Console, go to **Settings** → **API access**
2. Click **Create service account**
3. Follow link to Google Cloud Console
4. Create new service account
5. Download JSON key file
6. Save as `credentials.json` in your project root

**Important:** Keep this file secure and never commit it to git!

### 2.4 Grant Permissions

In Play Console:
1. Return to **API access**
2. Click the service account you created
3. Grant these permissions:
   - Access to Google Play Console
   - Manage app releases
   - Manage app store listings

---

## 🏗️ Step 3: Build with EAS

### 3.1 Initialize EAS (First Time Only)

```bash
cd /path/to/contractor-app

# Login to Expo
eas login
# Enter your Expo credentials

# Initialize EAS
eas build:configure
# Select: Android
```

This creates `eas.json` with build profiles.

### 3.2 Build for Production

```bash
# Build production AAB for Play Store
eas build --platform android --profile production

# This will:
# 1. Compile React Native to APK/AAB
# 2. Upload to EAS Build servers
# 3. Create production bundle (takes 5-10 min)

# You'll see:
# Build ID: xxxxx
# Status: completed
```

**Wait for build to complete.** Check email for confirmation.

### 3.3 Verify Build

```bash
# List your builds
eas build:list

# View details
eas build:view BUILD_ID

# Download APK for local testing (optional)
eas build:download --id BUILD_ID
```

---

## 🚀 Step 4: Submit to Google Play

### 4.1 Submit with EAS CLI

```bash
cd /path/to/contractor-app

# Submit latest build to Play Store
eas submit --platform android --latest

# Or submit specific build:
eas submit --platform android --id BUILD_ID

# When prompted:
# - Select Android
# - Use credentials.json for authentication
```

**First submission might take a moment to complete.**

### 4.2 Verify Submission

```bash
# Check submission status
eas submit:list

# View details
eas submit:view SUBMISSION_ID
```

---

## 📋 Step 5: Configure Release in Play Console

### 5.1 Review Submitted Build

1. Go to https://play.google.com/console
2. Select your app
3. Go to **Testing** → **Internal testing**
4. You should see your newly submitted build

### 5.2 Create Release

1. Click **Create release** in Internal testing
2. Select the build you just submitted
3. Add **Release notes** (Hebrew & English):

```
Hebrew:
"יצוא אוטומטי של דוחות שטח ותמונות. תמיכה מלאה בעברית."

English:
"Automated field report export with photo management. Full Hebrew support."
```

4. Review app details (already configured):
   - Privacy policy ✅
   - Content rating ✅
   - Permissions ✅

### 5.3 Test Before Production

**Option A: Internal Testing**
- Keep in Internal testing for 24-48 hours
- Invite testers to test on real devices
- Gather feedback and fix any issues
- Then promote to Production

**Option B: Direct to Production**
- If confident, proceed directly to Production
- Go to **Release** → **Production**
- Follow same steps to create release
- Submit for review

### 5.4 Submit for Review

1. Click **Review** button
2. Accept all policies
3. Submit for review
4. Google reviews within 24 hours typically

---

## 🧪 Step 6: Testing Before Submission

### 6.1 Local Testing with APK

```bash
# Download APK from EAS build
eas build:download --id BUILD_ID --path ./app.apk

# Install on Android device
adb install app.apk

# Test in app:
# - Login with test account
# - Upload photos
# - Create project
# - Check all features
```

### 6.2 Test Coverage

- [ ] App launches successfully
- [ ] Login/register works
- [ ] API connection successful
- [ ] Photo upload functional
- [ ] Project CRUD operations
- [ ] Worker attendance tracking
- [ ] Material inventory management
- [ ] Invoice creation and management
- [ ] Expense tracking
- [ ] Dashboard statistics display
- [ ] Offline mode (if applicable)
- [ ] Back button behavior
- [ ] Permissions requested correctly

### 6.3 Performance Testing

```bash
# Check for common issues:
# - App crashes on startup
# - Memory leaks
# - Slow API responses
# - Proper error handling
# - Network timeout handling
```

---

## 📦 Step 7: Manage Releases

### 7.1 Monitor Review Status

```bash
# Check review progress in Play Console:
# Settings → Release → Review status

# Typical timeline:
# - Internal testing: Immediate
# - Production: 24-48 hours
# - Once approved: Live on Play Store
```

### 7.2 Handle Review Rejection

If Google rejects the app:
1. Read rejection reason carefully
2. Fix issues in code
3. Commit changes
4. Rebuild with EAS
5. Resubmit

Common rejection reasons:
- Missing privacy policy ✅ (we have it)
- Inappropriate permissions ✅ (properly configured)
- Crashes on startup ✅ (test thoroughly)
- Missing functionality ✅ (fully implemented)

### 7.3 Update Released App

When you need to update:

```bash
# 1. Make code changes
git add .
git commit -m "Update app features"

# 2. Update version in app.json
# eas.json has autoIncrement: true, so version auto-increments

# 3. Build new version
eas build --platform android --profile production

# 4. Submit new build
eas submit --platform android --latest

# 5. Create release in Play Console with new notes
```

---

## 📊 Post-Launch Monitoring

### Monitor App Performance

1. Go to Play Console → **Quality** → **Crashes & ANRs**
   - Monitor crash reports
   - Fix critical issues immediately

2. Go to **Ratings & reviews**
   - Read user feedback
   - Respond to 1-star reviews
   - Fix reported issues

3. Go to **Stats → Overview**
   - Track installs
   - Monitor user retention
   - Check geographic distribution

### Rollback (if needed)

```bash
# If critical issue found:
# 1. Fix code
# 2. Rebuild
# 3. Submit new build
# 4. In Play Console, select previous stable build
# 5. Create release with "Rollback to previous version"
```

---

## 🔐 Security Checklist

- [ ] Credentials.json is in `.gitignore`
- [ ] API URL uses HTTPS only
- [ ] No secrets in code or app.json
- [ ] Permissions are minimal and justified
- [ ] Privacy policy is accurate and accessible
- [ ] JWT tokens handled securely
- [ ] Sensitive data encrypted in storage
- [ ] SSL certificate validation enabled

---

## 📝 Troubleshooting

### Issue: Build fails with "Dependency error"
```bash
# Solution: Clear cache and rebuild
eas build --platform android --profile production --clear-cache
```

### Issue: "Service account credentials invalid"
- Verify credentials.json is in project root
- Check API access permissions in Play Console
- Re-download credentials.json if needed

### Issue: "App rejected - Crashes on startup"
- Test APK locally first
- Check logs: `adb logcat | grep ERROR`
- Verify API URL in `.env.production`
- Ensure all required permissions granted

### Issue: "API connection timeout"
- Verify backend is running: `curl BACKEND_URL/api/v1`
- Check network connectivity in app
- Review backend logs for errors
- Increase request timeout if needed

### Issue: Photos not uploading
- Verify Cloudinary credentials in backend
- Check file size limits
- Ensure internet connection
- Review backend photo service logs

---

## 🔄 Continuous Updates

### Version Numbering Strategy

- **Major.Minor.Patch** (e.g., 1.0.0)
- `eas.json` has `autoIncrement: true`
- Version code increments automatically
- Update version in app.json as needed

### Release Timeline

- **v1.0.0** - Initial release
- **v1.0.1** - Bug fixes
- **v1.1.0** - Minor features
- **v2.0.0** - Major features/redesign

---

## 📞 Useful Links

- **Google Play Console:** https://play.google.com/console
- **EAS Documentation:** https://docs.expo.dev/build/introduction/
- **EAS Submit:** https://docs.expo.dev/build/submit/
- **Play Store Guidelines:** https://play.google.com/about/developer-content-policy/
- **Expo Documentation:** https://docs.expo.dev/
- **Android Permissions:** https://developer.android.com/guide/topics/permissions/overview

---

## ✅ Deployment Checklist

- [ ] Backend API deployed and accessible
- [ ] `.env.production` configured with correct API URL
- [ ] Google Play Developer account created
- [ ] Service account credentials downloaded
- [ ] `credentials.json` added to `.gitignore`
- [ ] EAS CLI authenticated
- [ ] `eas.json` created and configured
- [ ] Production build created
- [ ] App tested locally (APK)
- [ ] Build submitted to Google Play
- [ ] Release created in internal testing
- [ ] Tested by team members
- [ ] Release notes written (Hebrew & English)
- [ ] Release submitted to production
- [ ] App approved by Google (24-48 hours)
- [ ] App live on Play Store
- [ ] Monitoring set up in Play Console

---

**Status:** ✅ Ready for Publication  
**Last Updated:** September 1, 2026  
**Next Steps:** Follow steps 1-7 above to publish to Google Play Store

