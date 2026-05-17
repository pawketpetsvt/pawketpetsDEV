# PawketPetsVT — Neocities Upload Guide

## Files to Upload

Upload ALL of these to your Neocities dashboard. 
You can drag and drop them all at once.

### Root files (upload directly, not in any folder):
- index.html
- login.html
- register.html
- adopt.html
- mypets.html
- shop.html
- minigames.html
- news.html

### Folders (create these first in Neocities, then upload files inside):
- css/
    - style.css
- js/
    - supabase.js
    - auth.js

### Image folders (create these, upload art here later):
- images/
    - images/pets/       ← pet artwork goes here (ember.png, pyxie.png, placeholder.png)
    - images/items/      ← shop item art goes here
    - images/ui/         ← buttons, backgrounds, decorations

## IMPORTANT — Add Your Supabase Anon Key

Before uploading, open js/supabase.js and replace:
    PASTE_YOUR_ANON_KEY_HERE
with your actual anon key from:
Supabase Dashboard → Settings → API → "anon public" key

## How to create folders on Neocities:
1. Go to your Neocities dashboard
2. Click "New Folder" 
3. Name it (css, js, images, etc.)
4. Click into the folder
5. Upload the files for that folder

## After uploading:
Your site will be live at: https://YOUR-USERNAME.neocities.org

Test these pages work:
✓ Home page loads
✓ Register page — create a test account
✓ Login page — log in with that account
✓ Nav shows your username after login
✓ Logout button works
