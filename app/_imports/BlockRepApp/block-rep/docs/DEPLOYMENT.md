# Deployment Guide

This guide covers deploying Block Rep to production environments including TestFlight, App Store, and setting up production backend services.

## Table of Contents

1. [Backend Deployment](#backend-deployment)
2. [iOS Deployment](#ios-deployment)
3. [Android Deployment](#android-deployment)
4. [Production Checklist](#production-checklist)

## Backend Deployment

### 1. Supabase Production Setup

#### Create Production Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project with production settings
3. Choose appropriate region for your users
4. Note down connection details

#### Deploy Database Schema
```bash
# Connect to production database
supabase link --project-ref your-production-project-ref

# Run migrations in order
supabase db reset
supabase db push
```

#### Set Up Production Secrets
```bash
# Set environment variables
supabase secrets set --env-file .env.production

# Required secrets:
supabase secrets set TWILIO_ACCOUNT_SID=your_production_sid
supabase secrets set TWILIO_AUTH_TOKEN=your_production_token
supabase secrets set TWILIO_PHONE_NUMBER=your_production_number
supabase secrets set SUPABASE_URL=your_production_url
supabase secrets set SUPABASE_ANON_KEY=your_production_anon_key
supabase secrets set SUPABASE_SERVICE_KEY=your_production_service_key
```

#### Deploy Edge Functions
```bash
# Deploy all functions
supabase functions deploy send-sms --project-ref your-production-project-ref
supabase functions deploy receive-sms --project-ref your-production-project-ref
supabase functions deploy location-update --project-ref your-production-project-ref
```

### 2. Twilio Production Setup

#### Get Production Number
1. Go to Twilio Console
2. Buy a phone number in your target region
3. Configure messaging webhook:
   ```
   https://your-production-project.supabase.co/functions/v1/receive-sms
   ```

#### Configure Messaging Service
1. Create a Messaging Service
2. Add your production number
3. Set webhook URL for incoming messages

### 3. Firebase Production Setup

#### Create Production Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project
3. Add iOS and Android apps
4. Download configuration files

#### Configure Push Notifications
1. Set up APNs certificates (iOS)
2. Configure FCM (Android)
3. Upload service account key to Supabase

## iOS Deployment

### 1. App Store Connect Setup

#### Create App Record
1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click "My Apps"
3. Click "+" to create new app
4. Fill in app details:
   - Name: Block Rep
   - Bundle ID: com.blockrep.app
   - SKU: blockrep-001
   - Primary Language: English

#### Configure App Information
1. Set app category: Business
2. Add privacy policy URL
3. Configure app pricing
4. Set availability regions

### 2. Xcode Configuration

#### Update Build Settings
```bash
# Set production bundle ID
# Update version and build numbers
# Configure code signing
```

#### Archive and Upload
1. Select "Any iOS Device" as build target
2. Product > Archive
3. Wait for archive to complete
4. Click "Distribute App"
5. Select "App Store Connect"
6. Upload to App Store Connect

### 3. TestFlight Deployment

#### Internal Testing
1. Go to App Store Connect > TestFlight
2. Add internal testers
3. Create new test group
4. Add build to test group
5. Invite testers via email

#### External Testing
1. Create external testing group
2. Add build for external testing
3. Submit for Beta App Review
4. Wait for approval (1-3 days)
5. Share public TestFlight link

### 4. App Store Submission

#### Prepare App Store Listing
1. Add app screenshots (6.7" and 5.5" required)
2. Write app description
3. Add keywords
4. Set app icon (1024x1024)
5. Configure app privacy details

#### Submit for Review
1. Select production build
2. Fill in version information
3. Submit for App Review
4. Wait for approval (1-3 days)
5. Release to App Store

## Android Deployment

### 1. Google Play Console Setup

#### Create App Record
1. Go to [Google Play Console](https://play.google.com/console/)
2. Click "Create app"
3. Fill in app details:
   - App name: Block Rep
   - Developer: Your company name
   - Category: Business

#### Configure App Details
1. Set app description
2. Add screenshots
3. Configure content rating
4. Set pricing and distribution

### 2. Build Production APK/AAB

#### Generate Signing Key
```bash
# Generate keystore
keytool -genkey -v -keystore blockrep-release.keystore -alias blockrep -keyalg RSA -keysize 2048 -validity 10000
```

#### Build Release
```bash
# Build Android release
cd android
./gradlew assembleRelease
# or for AAB
./gradlew bundleRelease
```

#### Sign the Build
```bash
# Sign APK
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore blockrep-release.keystore app-release-unsigned.apk blockrep

# Align APK
zipalign -v 4 app-release-unsigned.apk blockrep-release.apk
```

### 3. Upload to Play Console

#### Upload Production Build
1. Go to Play Console > Release
2. Click "Create new release"
3. Upload APK or AAB file
4. Fill in release notes
5. Save and review

#### Internal Testing
1. Create internal test track
2. Upload build to internal test
3. Add internal testers
4. Share internal test link

#### Production Release
1. Promote build to production
2. Review and confirm release
3. Wait for review (1-7 days)
4. App goes live automatically

## Production Checklist

### Backend
- [ ] Production Supabase project created
- [ ] Database schema deployed
- [ ] RLS policies configured
- [ ] Edge functions deployed
- [ ] Environment variables set
- [ ] Twilio production number configured
- [ ] Firebase production project set up
- [ ] Push notifications configured
- [ ] SSL certificates configured
- [ ] Backup strategy implemented

### iOS App
- [ ] App Store Connect app created
- [ ] Bundle ID configured
- [ ] Provisioning profiles created
- [ ] Production build archived
- [ ] TestFlight testing completed
- [ ] App Store screenshots ready
- [ ] App description written
- [ ] Privacy policy configured
- [ ] App submitted for review

### Android App
- [ ] Google Play Console app created
- [ ] Signing keystore generated
- [ ] Production build signed
- [ ] Internal testing completed
- [ ] Play Store listing ready
- [ ] Content rating completed
- [ ] App submitted for review

### Monitoring
- [ ] Crash reporting configured
- [ ] Analytics set up
- [ ] Performance monitoring enabled
- [ ] Error tracking configured
- [ ] User feedback system ready

### Documentation
- [ ] User documentation created
- [ ] Admin documentation ready
- [ ] API documentation available
- [ ] Troubleshooting guide created

## 🚨 Production Considerations

### Security
- Rotate all API keys
- Enable audit logging
- Set up intrusion detection
- Configure rate limiting
- Review CORS policies

### Performance
- Enable database connection pooling
- Configure CDN for static assets
- Set up caching strategies
- Monitor query performance
- Optimize image delivery

### Scalability
- Configure auto-scaling
- Set up load balancing
- Plan for database growth
- Monitor resource usage
- Set up alerting

### Backup and Recovery
- Enable automated backups
- Test restore procedures
- Document recovery process
- Set up monitoring alerts
- Plan for disaster recovery

## 📊 Post-Launch Monitoring

### Key Metrics to Track
- Daily Active Users (DAU)
- Session duration
- Feature adoption rates
- Crash rates
- API response times
- Database performance
- User feedback scores

### Monitoring Tools
- Supabase Analytics
- Firebase Analytics
- Crashlytics
- Custom dashboards
- User feedback tools

### Regular Maintenance
- Weekly performance reviews
- Monthly security audits
- Quarterly feature updates
- Regular dependency updates
- User feedback analysis

## 🆘 Support and Rollback

### Emergency Contacts
- Technical Lead: [contact info]
- DevOps Engineer: [contact info]
- Product Manager: [contact info]

### Rollback Procedures
1. **Backend Rollback**
   - Revert database migrations
   - Rollback Edge Functions
   - Restore from backup if needed

2. **iOS Rollback**
   - Remove app from sale
   - Submit previous version
   - Communicate with users

3. **Android Rollback**
   - Unpublish current version
   - Upload previous version
   - Monitor for issues

### Communication Plan
1. Notify stakeholders immediately
2. Update status page
3. Communicate with users
4. Post-mortem analysis
5. Process improvements

---

For additional support, refer to the main README.md or contact the development team.