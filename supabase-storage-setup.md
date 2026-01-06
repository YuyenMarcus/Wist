# Supabase Storage Setup for Image Uploads

## Step 1: Create Storage Bucket

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard/project/ulmhmjqjtebaetocuhno
2. Click **Storage** (left sidebar)
3. Click **New bucket**
4. Configure:
   - **Name**: `wishlist-images`
   - **Public bucket**: ✅ **YES** (so images can be accessed via URL)
   - **File size limit**: 5 MB (or your preference)
   - **Allowed MIME types**: `image/jpeg, image/png, image/gif, image/webp`
5. Click **Create bucket**

## Step 2: Set Up Storage Policies

Go to **Storage** → **Policies** → Select `wishlist-images` bucket

### Policy 1: Allow authenticated users to upload
```sql
CREATE POLICY "Users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wishlist-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Policy 2: Allow users to update their own images
```sql
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'wishlist-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Policy 3: Allow users to delete their own images
```sql
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'wishlist-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Policy 4: Allow public to read images
```sql
CREATE POLICY "Public can read images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'wishlist-images');
```

## Step 3: Update Products Table

Add a column to track if image is from storage:

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_source text DEFAULT 'url';
-- 'url' = from scraped URL
-- 'storage' = uploaded to Supabase Storage
```

## Usage in Application

Images will be stored at: `wishlist-images/{user_id}/{timestamp}.{ext}`

Public URL format: `https://{project-ref}.supabase.co/storage/v1/object/public/wishlist-images/{user_id}/{filename}`







