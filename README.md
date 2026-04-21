# Medvault
Healthcare data management for families is fragmented, paper-heavy, and error-prone. Prescriptions pile up in drawers, lab reports are scattered across apps, and critical drug interactions go unnoticed.
MedVault solves this by providing:

🗂️ A unified vault for all medical records across every family member
🤖 An AI assistant that answers health queries in natural language
📷 OCR-powered scanning that reads prescriptions and lab reports automatically
📊 Visual health trends for blood sugar, blood pressure, and HbA1c
⏰ Smart medication reminders with real alarm audio
🔗 Secure, expiring share links to hand off records to doctors

All of this runs entirely in the browser — no servers, no accounts, no data leaks.

Features
🧠 AI Health Assistant

Conversational chatbot trained on the user's own health records
Understands natural queries like "What was my sugar in April?" or "List my medicines"
Returns date-specific vitals: Blood Sugar, Systolic BP, HbA1c
Voice Input via Web Speech API — speak your query, get instant answers
Text-to-Speech output toggle for hands-free interaction

📷 OCR Document Scanner

Upload JPG/PNG prescriptions or lab reports
Powered by Tesseract.js v5 — fully on-device, zero data sent to cloud
Auto-detects: Doctor name, medicines, diagnosis, HbA1c values, record type
Auto-fills the record form for one-tap confirmation and save
Extracted HbA1c values are automatically appended to the vitals graph
Real-time progress bar during scan

📊 Vitals & Lab Trends Graph

Interactive Chart.js line graph tracking 3 parameters over time:

🩸 Blood Sugar (mg/dL)
💓 Systolic Blood Pressure (mmHg)
🧪 HbA1c (%)


Smooth animations, hover tooltips, and responsive legends
Data auto-updates when new vitals or OCR-extracted values are saved

👨‍👩‍👧 Multi-Profile Family Vault

Create unlimited family member profiles (Self, Spouse, Parent, Child, etc.)
Switch between profiles with a single dropdown tap
Each profile has isolated records, vitals history, and reminders
Delete a member and all their data in one tap
Persistent across sessions via localStorage

⏰ Medication Reminders

Set daily timed alarms by medicine name
Browser-native alarm audio fires at the scheduled time
Dismissal records the dose as taken for the day
Active reminder list with individual delete controls
Works even when the app is running in a background tab

💊 Drug Interaction Checker

Compares newly prescribed medicines against the patient's full prescription history
Flags dangerous combinations (e.g. Lisinopril + Ibuprofen, Aspirin + Warfarin)
Warning banner appears inline on the upload form before saving
Real-time re-check as medicines field is typed

🔗 Secure Record Sharing

Generates a token-based expiring URL to share the health timeline
Expiry options: 1 Day, 1 Month, 2 Months
One-tap copy to clipboard
Designed for safe handoff to doctors or specialists

🎙️ Voice Vital Logging

Dictate vitals directly into the health log form
Recognises patterns like "My sugar is 110, pressure 120"
Parses sugar, BP, HbA1c, and dates (today / yesterday / specific dates)
Falls back gracefully when speech recognition is unavailable

🌙 Night Mode

Full dark/light theme toggle
Adjusts glass surfaces, text opacity, orb intensity, and shadows
Preference saved and restored across sessions
