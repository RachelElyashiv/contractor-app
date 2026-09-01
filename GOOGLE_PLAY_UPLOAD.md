# הנחיות העלאה ל-Google Play Store

## שלב 1: הכנת Google Play Console

1. כנסו ל- [Google Play Console](https://play.google.com/console)
2. בחרו **"Create App"** או בחרו את האפליקציה הקיימת `com.rachelelyashiv.contractorapp`
3. מלאו את פרטי האפליקציה:
   - **שם**: Contractor App / אפליקציית קבלן
   - **תיאור קצר**: ניהול דוחות שטח ומסמכים מקצועיים
   - **תיאור ארוך**: אפליקציה לניהול דוחות שטח ומסמכים עבור קבלנים וייעוצים מקצועיים
   - **קטגוריה**: Business
   - **דירוג תוכן**: בדקו את הדרוש

## שלב 2: הכנת Signing Certificate

1. כנסו ל- Google Play Console
2. בחרו **Settings → App Signing** 
3. Google Play יצור עבורכם certificat אוטומטית (זה קורה בעצמאות)

## שלב 3: קבלת Service Account

1. בחרו **Settings → API Access**
2. בחרו **Create New Service Account**
3. העתיקו את ה-JSON credentials
4. שמרו אותו כ-`credentials.json` בתיקייה הראשית של הפרויקט

## שלב 4: Build ו-Upload

### Option A: דרך EAS (מומלץ)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to EAS
eas login

# Build for production
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android --latest
```

### Option B: Build ידני

```bash
# Build locally
eas build --platform android --profile production --local

# Upload to Google Play Console ידנית דרך Web UI
```

## שלב 5: תמונות וחומרים נוספים (ב-Google Play Console)

### תמונות נדרשות:
- **דברים מיני (Feature graphic)**: 1024x500 px
- **צילומי מסך (Screenshots)**: 
  - לפחות 2 צילומי מסך
  - לכל היותר 8 צילומי מסך
  - גודל: 1080x1920 px (או יחס 9:16)
- **אייקון אפליקציה (Icon)**: 512x512 px

### תיאורים:
- **כותרת קטגוריה**: 50 תווים מקסימום
- **תיאור קטן**: 80 תווים מקסימום  
- **תיאור מלא**: 4000 תווים מקסימום

## שלב 6: שאלות רישוי

בחרו את הקטגוריות שחלות עליכם:
- ✓ האפליקציה עובדת בלא חיבור אינטרנט (offline mode)
- ✓ יש מצלמה וגישה לתמונות

## שלב 7: הגשה בדיקה

1. בחרו **Release → Create Release**
2. בחרו **Internal Testing** (הדיקה ראשונה)
3. הוסיפו testers
4. אחרי שהכל בדוק, עברו ל-**Production**

## שלב 8: המתינו לאישור

- Google Play יבדוק את האפליקציה (בדרך כלל 24-48 שעות)
- תקבלו הודעה כאשר היא אושרה

---

## תעודות ה-SHA-1 של Signing

אם נדרשות לכם תעודות SHA-1:

```bash
# הדפיסו את התעודות
eas credentials show --platform android
```

---

## עדכון גרסאות עתידיות

לכל עדכון:
1. עדכנו את `version` ב-`app.json`
2. בנו: `eas build --platform android --profile production`
3. הגישו: `eas submit --platform android --latest`
