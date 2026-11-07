# PUVIMA Consultancy — Google Drive Resume Upload Integration & Setup Guide

This guide details step-by-step instructions to configure Google Drive API v3 using a Google Cloud Service Account for automated candidate resume uploads on the PUVIMA website.

---

## 1. Overview & Architecture

When a candidate applies on `https://puvima.com/pages/careers.html`:
1. The applicant uploads their actual resume file (`.pdf`, `.doc`, `.docx`, max 5 MB).
2. The PUVIMA backend validates document extensions, MIME types, and binary magic bytes.
3. The server authenticates with Google Drive API v3 via a private Service Account JWT.
4. The resume is uploaded directly into PUVIMA's private folder:
   ```
   PUVIMA Consultancy / Recruitment / Internship Applications
   ```
5. Google Drive API returns the authentic file ID and web view URL (`https://drive.google.com/file/d/{fileId}/view`).
6. All application data and the Google Drive URL are persisted in MySQL.
7. An automated notification email containing applicant details and the Drive link is dispatched to `RECRUITMENT_EMAIL`.
8. The resume is immediately accessible to authorized recruitment administrators inside the PUVIMA Executive Admin Portal.

---

## 2. Step-by-Step Google Cloud Setup

### Step 1: Create or Select a Google Cloud Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** at the top &rarr; **New Project**.
3. Enter Project Name: `PUVIMA-Consultancy` (or your preferred name).
4. Click **Create**.

### Step 2: Enable the Google Drive API
1. In the Google Cloud Console, open the navigation menu and select **APIs & Services** &rarr; **Library**.
2. Search for `Google Drive API`.
3. Click on **Google Drive API** in the results.
4. Click the blue **Enable** button.

### Step 3: Create a Dedicated Service Account
1. In the left navigation, go to **APIs & Services** &rarr; **Credentials**.
2. Click **+ CREATE CREDENTIALS** &rarr; **Service account**.
3. Enter details:
   - **Service account name**: `puvima-resume-uploader`
   - **Service account ID**: `puvima-resume-uploader` (auto-filled)
   - **Description**: `Uploads candidate internship resumes to PUVIMA Google Drive recruitment folder.`
4. Click **Create and Continue**.
5. Role assignment is optional (the service account only needs folder-level access in Google Drive). Click **Done**.

### Step 4: Generate and Download the Private Key
1. Under **Credentials** &rarr; **Service Accounts**, click on the newly created service account email (e.g. `puvima-resume-uploader@puvima-consultancy.iam.gserviceaccount.com`).
2. Navigate to the **Keys** tab.
3. Click **ADD KEY** &rarr; **Create new key**.
4. Choose **JSON** and click **Create**.
5. Save the downloaded JSON file securely on your local computer. **Never commit this JSON file to version control.**

From the downloaded JSON file, note:
- `client_email` &rarr; use for `GOOGLE_DRIVE_CLIENT_EMAIL`
- `private_key` &rarr; use for `GOOGLE_DRIVE_PRIVATE_KEY`

---

## 3. Create and Share the Designated Google Drive Folder

1. Open [Google Drive](https://drive.google.com/) signed in with your PUVIMA workspace or recruitment administrator account.
2. Create your dedicated folder hierarchy:
   ```
   PUVIMA Consultancy
   └── Recruitment
       └── Internship Applications
   ```
3. Open the `Internship Applications` folder.
4. Inspect the URL in your browser:
   ```
   https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I0J_EXAMPLE
   ```
   The string after `/folders/` (`1A2B3C4D5E6F7G8H9I0J_EXAMPLE`) is your **`GOOGLE_DRIVE_FOLDER_ID`**.
5. Right-click the `Internship Applications` folder &rarr; click **Share**.
6. In the **Add people and groups** field, paste your service account email:
   ```
   puvima-resume-uploader@puvima-consultancy.iam.gserviceaccount.com
   ```
7. Set permission to **Editor** (required for creating files).
8. Uncheck "Notify people" (service accounts don't receive emails) and click **Share**.

---

## 4. Backend Environment Configuration

Add the credentials to your server's `backend/.env` file:

```env
# ============================================================================
# Google Drive API Resume Storage Integration
# ============================================================================
GOOGLE_DRIVE_CLIENT_EMAIL=puvima-resume-uploader@puvima-consultancy.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=1A2B3C4D5E6F7G8H9I0J_EXAMPLE

# ============================================================================
# Recruitment Email Notifications (Nodemailer SMTP)
# ============================================================================
RECRUITMENT_EMAIL=contact@puvima.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=contact@puvima.com
SMTP_PASS=your-app-password
MAIL_FROM=contact@puvima.com
```

> **Security Note on Multi-line Keys:** The `GOOGLE_DRIVE_PRIVATE_KEY` can be entered as a single line with `\n` characters enclosed in quotes. The PUVIMA backend automatically converts `\n` literals into valid PEM line breaks.

---

## 5. Security & Access Control Policies

1. **Backend Isolation**: Google Drive API credentials reside exclusively on the Node.js server. No client-side script or browser ever receives private keys.
2. **Access Control**: Applicant resumes remain in the private recruitment folder. Only members of the recruitment team and the service account have access.
3. **No Fabrication**: Google Drive URLs are generated from the actual uploaded file ID returned by `drive.files.create()`.
4. **Resilience**: If Google Drive encounters transient network rate limits or if credentials are misconfigured, the backend safely preserves the uploaded file in local server storage and maintains the MySQL application record.

