# Deploy Dog Breed Game to AWS S3

Step-by-step guide to host the game as a static website on Amazon S3.

---

## Prerequisites

- An [AWS account](https://aws.amazon.com)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and configured
- Your game files in `dog-breed-game/` (e.g. `index.html`, `styles.css`, `game.js`)

---

## Step 1: Install and configure AWS CLI (if needed)

**Install (Windows – PowerShell):**
```powershell
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi
```

**Configure (run once):**
```bash
aws configure
```
Enter your:
- **AWS Access Key ID**
- **AWS Secret Access Key**
- **Default region** (e.g. `us-east-1`)

---

## Step 2: Create an S3 bucket

Pick a **globally unique** bucket name (e.g. `my-dog-breed-game`).

```bash
aws s3 mb s3://YOUR-BUCKET-NAME --region us-east-1
```

Example:
```bash
aws s3 mb s3://my-dog-breed-game --region us-east-1
```

---

## Step 3: Enable static website hosting on the bucket

```bash
aws s3 website s3://YOUR-BUCKET-NAME --index-document index.html --error-document index.html
```

Use `index.html` for both index and error so your client-side routing (if any) works when users open deep links or refresh.

---

## Step 4: Make the bucket public for website access

Create a bucket policy so the site can be read by everyone.

**4a.** Save this as `bucket-policy.json` in your project folder (replace `YOUR-BUCKET-NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

**4b.** Apply the policy:

```bash
aws s3api put-bucket-policy --bucket YOUR-BUCKET-NAME --policy file://bucket-policy.json
```

---

## Step 5: Block public “bucket” (list) access (recommended)

You want the **objects** (files) to be public, but not the bucket **listing**. Uncheck “Block all public access” only for the bucket, then use the policy above so only `GetObject` is allowed.  
If “Block public access” is fully on, the policy in Step 4 won’t work until you turn off “Block all public access” for this bucket in the console (S3 → bucket → Permissions).

---

## Step 6: Upload your game files

From the folder that contains `index.html`, `styles.css`, and `game.js`:

```bash
aws s3 sync . s3://YOUR-BUCKET-NAME --exclude ".git/*" --exclude "*.md" --exclude "node_modules/*"
```

Or upload only the needed files:

```bash
aws s3 cp index.html s3://YOUR-BUCKET-NAME/
aws s3 cp styles.css s3://YOUR-BUCKET-NAME/
aws s3 cp game.js s3://YOUR-BUCKET-NAME/
```

**Optional – set cache and content-type for better performance:**
```bash
aws s3 sync . s3://YOUR-BUCKET-NAME \
  --exclude ".git/*" --exclude "*.md" \
  --cache-control "max-age=3600" \
  --content-type "text/html" \
  --content-type "text/css" \
  --content-type "application/javascript"
```

For a simple one-time upload, the first `sync` or `cp` commands are enough.

---

## Step 7: Get your website URL

S3 website URLs look like:

- **Region format:**  
  `http://YOUR-BUCKET-NAME.s3-website-REGION.amazonaws.com`  
  Example: `http://my-dog-breed-game.s3-website-us-east-1.amazonaws.com`

- **Dual-stack / legacy:**  
  `http://YOUR-BUCKET-NAME.s3-website.REGION.amazonaws.com`

Open that URL in a browser to test the game.

---

## Step 8 (Optional): Use a custom domain with HTTPS

1. **Request an SSL certificate** in [AWS Certificate Manager (ACM)](https://console.aws.amazon.com/acm/) for your domain (e.g. `game.yourdomain.com`).
2. **Create a CloudFront distribution**  
   - Origin: your S3 website endpoint  
     `YOUR-BUCKET-NAME.s3-website-REGION.amazonaws.com`  
   - Alternate domain (CNAME): your domain  
   - Custom SSL certificate: the ACM certificate
3. **Point your domain** (in your DNS) to the CloudFront domain name (e.g. `d1234abcd.cloudfront.net`) with a CNAME record.

---

## Quick reference

| Task              | Command |
|-------------------|--------|
| Create bucket     | `aws s3 mb s3://YOUR-BUCKET-NAME --region us-east-1` |
| Enable website    | `aws s3 website s3://YOUR-BUCKET-NAME --index-document index.html --error-document index.html` |
| Apply policy      | `aws s3api put-bucket-policy --bucket YOUR-BUCKET-NAME --policy file://bucket-policy.json` |
| Upload files      | `aws s3 sync . s3://YOUR-BUCKET-NAME --exclude ".git/*" --exclude "*.md"` |
| Website URL       | `http://YOUR-BUCKET-NAME.s3-website-us-east-1.amazonaws.com` |

---

## Troubleshooting

- **403 Forbidden**  
  - Bucket policy must allow `s3:GetObject` for `Principal "*"` on `arn:aws:s3:::YOUR-BUCKET-NAME/*`.  
  - If “Block all public access” is on for the bucket, turn it off (only for this bucket).

- **404 on refresh / deep link**  
  - Set error document to `index.html` (Step 3).

- **CORS (if you add APIs later)**  
  - Add a CORS configuration on the bucket in S3 → Permissions → CORS.

Replace `YOUR-BUCKET-NAME` and `REGION` with your bucket name and region in all steps.
