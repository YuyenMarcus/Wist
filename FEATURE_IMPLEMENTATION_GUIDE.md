# Feature Implementation Guide

This guide outlines the implementation order for core wishlist features, focusing on backend/database logic before UI.

## ✅ Implementation Order

### 1. ✅ Reservation System (COMPLETED)
**Files Created:**
- `supabase-reservation-system.sql` - Database schema and RLS policies
- Updated `lib/supabase/products.ts` - Reservation functions

**What It Does:**
- Adds `reserved_by` and `reserved_at` columns to products table
- Allows authenticated users to reserve items they don't own
- Hides `reserved_by` from owners (to avoid spoiling surprises)
- Allows users to unreserve items they reserved

**Next Steps:**
- Run `supabase-reservation-system.sql` in Supabase SQL Editor
- Test reservation functions in application

---

### 2. ✅ Public vs Private Visibility (COMPLETED)
**Files Created:**
- `supabase-public-private-visibility.sql` - Database schema and RLS policies
- Updated `lib/supabase/products.ts` - Public/private functions

**What It Does:**
- Adds `is_public` and `share_token` columns
- Allows public access to items marked as public
- Supports sharing via username or share token
- Updates RLS policies for public viewing

**Next Steps:**
- Run `supabase-public-private-visibility.sql` in Supabase SQL Editor
- Create public wishlist view page (`/u/[username]`)

---

### 3. ✅ Username Setup (COMPLETED)
**Files Created:**
- `supabase-username-setup.sql` - Database schema
- Updated `lib/supabase/profile.ts` - Username functions

**What It Does:**
- Adds `username` and `username_set_at` to profiles table
- Enforces unique usernames
- Validates username format (3-30 chars, alphanumeric + _ -)
- Allows public profile lookup by username

**Next Steps:**
- Run `supabase-username-setup.sql` in Supabase SQL Editor
- Create onboarding flow to prompt username on first login
- Update account page to allow username editing

---

### 4. ✅ Supabase Storage Setup (COMPLETED)
**Files Created:**
- `supabase-storage-setup.md` - Setup instructions

**What It Does:**
- Documents how to create `wishlist-images` storage bucket
- Provides RLS policies for image uploads
- Explains file structure and public URL format

**Next Steps:**
- Follow instructions in `supabase-storage-setup.md`
- Create image upload component
- Update product form to support image uploads

---

## 🚀 Quick Start

### Step 1: Run SQL Migrations

Run these SQL files in order in Supabase Dashboard → SQL Editor:

1. `supabase-reservation-system.sql`
2. `supabase-public-private-visibility.sql`
3. `supabase-username-setup.sql`

### Step 2: Set Up Storage

Follow instructions in `supabase-storage-setup.md` to:
1. Create `wishlist-images` bucket
2. Set up storage policies
3. Add `image_source` column to products table

### Step 3: Test Backend Functions

All TypeScript functions are ready in:
- `lib/supabase/products.ts` - Product operations
- `lib/supabase/profile.ts` - Profile operations

### Step 4: Build UI Components

Now you can build the UI with confidence that the backend is ready:
- Owner View vs Guest View for product cards
- Public wishlist page (`/u/[username]`)
- Username onboarding modal
- Image upload component

---

## 📋 Database Schema Summary

### Products Table (Updated)
```sql
- reserved_by (text) - Who reserved/purchased the item
- reserved_at (timestamp) - When it was reserved
- is_public (boolean) - Public visibility flag
- share_token (text) - Unique token for sharing
- image_source (text) - 'url' or 'storage'
```

### Profiles Table (Updated)
```sql
- username (text, unique) - Public handle for sharing
- username_set_at (timestamp) - When username was set
```

---

## 🔒 Security Notes

- **Reservations**: Users cannot reserve their own items
- **Visibility**: Only owners can change `is_public` status
- **Usernames**: Must be unique and follow format rules
- **Storage**: Users can only upload/delete their own images
- **RLS**: All policies enforce user ownership and permissions

---

## 🎯 Next UI Components to Build

1. **Product Card (Owner View)**
   - Edit/Delete buttons
   - Public/Private toggle
   - Shows "Reserved" status (but not by whom)

2. **Product Card (Guest View)**
   - Reserve/Unreserve button
   - Shows who reserved it (if applicable)

3. **Public Wishlist Page** (`/u/[username]`)
   - Shows all public items for a user
   - Guest view for all items

4. **Username Onboarding**
   - Modal on first login
   - Username validation
   - Redirect to account setup

5. **Image Upload Component**
   - Drag & drop or file picker
   - Upload to Supabase Storage
   - Preview before saving

