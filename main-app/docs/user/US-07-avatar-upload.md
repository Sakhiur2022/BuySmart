This is a great user story to work on. I'll create a comprehensive, developer-ready agile document that meets all your requirements.

First, I'll explore the codebase to identify the exact files that will need to be created or modified for this feature. This will ensure the plan is precise and actionable for the development team. I'll launch a subagent to handle this exploration.

Explore codebase for avatar upload feature files

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/lib/actions)

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/lib/repositories)

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/lib/services)

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/app/%28buyer%29/profile/settings/page.tsx#1-1), lines 1 to 100

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/app/%28seller%29/seller/settings/page.tsx)

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/components/forms/user-profile-form.tsx#1-1), lines 1 to 150

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/components/forms/seller-settings-form.tsx#1-1), lines 1 to 150

Searched for regex `users_profile|profiles table|avatarUrl|avatar_url`, 20 results

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/lib/types)

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/lib/models)

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/lib/types/database.types.ts#1-1), lines 1 to 200

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/lib/actions/settings.ts#1-1), lines 1 to 150

Searched for text `users_profile` (`**/main-app/lib/types/database.types.ts`), 1 result

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/lib/types/database.types.ts#1000-1000), lines 1000 to 1036

Searched for regex `users_profile:\s*\{` (`**/main-app/lib/types/database.types.ts`), 1 result

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/lib/types/database.types.ts#674-674), lines 674 to 800

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/components/forms/user-profile-form.tsx#1-1), lines 1 to 400

Searched for text `avatar|upload`, 20 results

Read [](file:///c%3A/Users/Sakhiur/OneDrive/NSU/Fourth%20year/Ninth%20Semester%20%28Spring%202026%29/CSE327.2/Project/BuySmart/main-app/app/api)

Searched for text `Supabase storage|bucket|uploadFile`, 20 results

I have analyzed the project structure and your requirements. Here is the complete, developer-ready Agile Scrum user story document for the avatar upload feature.

I will now create the file `docs/user/US-07-avatar-upload.md` with the following content.

```markdown
# US-07: Avatar Upload

## 1. Story Header

- **ID**: US-07
- **Title**: Avatar Upload
- **Epic**: USER-02 — Avatar upload with Supabase Storage
- **Priority**: Low
- **Story Points**: 3
- **Status**: To Do

## 2. User Story

> As a **user**, I want to **upload a profile picture** so that **my account is personalized**.

## 3. Personas

### Buyer

- **Name**: Alex
- **Goal**: Wants to add a personal touch to their profile to feel more connected to the platform. The avatar helps them quickly identify their account in the navbar.

### Seller

- **Name**: Sam
- **Goal**: Wants to upload a professional headshot or a brand logo to build trust and brand recognition with potential customers.

## 4. Acceptance Criteria

**Scenario: Successful Avatar Upload**

- **Given** I am on my profile settings page
- **When** I select a valid image file (JPG, PNG, WEBP, <2MB) and click "Upload"
- **Then** I see a loading indicator while the image uploads
- **And** the new avatar is displayed in the preview area and in the site navbar
- **And** a success message confirms the update

**Scenario: Invalid File Type**

- **Given** I am on my profile settings page
- **When** I attempt to upload a file that is not a JPG, PNG, or WEBP
- **Then** the system rejects the file
- **And** I see an error message stating "Invalid file type. Please upload a JPG, PNG, or WEBP."

**Scenario: File Size Exceeds Limit**

- **Given** I am on my profile settings page
- **When** I attempt to upload an image file larger than 2MB
- **Then** the system rejects the file
- **And** I see an error message stating "File is too large. Please upload an image under 2MB."

**Scenario: Replace Existing Avatar**

- **Given** I already have an avatar set for my profile
- **When** I upload a new valid image
- **Then** the old avatar file is removed from storage
- **And** the new avatar replaces the old one across the application

**Scenario: Remove Avatar**

- **Given** I have an existing avatar
- **When** I click the "Remove" button next to my avatar
- **Then** the system prompts me for confirmation
- **And** upon confirming, my avatar is removed and replaced with a default placeholder
- **And** the avatar file is deleted from storage

**Scenario: Upload Fails**

- **Given** I am uploading a valid image
- **When** a network or server error occurs during the upload
- **Then** I see an error message like "Upload failed. Please try again."
- **And** my current avatar (or default) remains unchanged

## 5. Technical Notes

- **Supabase Storage**:
  - **Bucket Name**: `avatars`
  - **RLS Policies**:
    - `SELECT`: Public access for viewing avatars.
    - `INSERT`: Authenticated users can upload to their own folder (`avatars/{userId}/...`).
    - `UPDATE`: Authenticated users can update files in their own folder.
    - `DELETE`: Authenticated users can delete files from their own folder.
- **File Path Convention**: `avatars/{userId}/{filename}`. Using a unique identifier in the filename (e.g., timestamp or UUID) is recommended to prevent cache issues.
- **Accepted MIME Types**: `image/jpeg`, `image/png`, `image/webp`. Validation will be handled client-side with Zod and re-validated on the server.
- **Max File Size**: 2MB.
- **Avatar URL Storage**:
  - **Recommendation**: Use the existing `avatar_url` column in the `profiles` table.
  - **Justification**: The codebase already uses a `profiles` table for user-specific data that goes beyond authentication details. Storing the avatar URL here keeps all profile-related data consolidated, is more scalable than `user_metadata`, and aligns with the existing data model.
- **Files to Create/Modify**:
  - `main-app/components/forms/user-profile-form.tsx`: Modify to include a file input component for avatar upload.
  - `main-app/components/forms/seller-settings-form.tsx`: Modify to include the same avatar upload component.
  - `main-app/lib/actions/settings.ts`: Add or modify server actions to handle the avatar upload logic (uploading to Supabase Storage and updating the `profiles` table).
  - `main-app/lib/services/avatar-service.ts` (New): Create a service to encapsulate Supabase Storage interactions (upload, delete, get public URL).
  - `main-app/lib/repositories/profile-repository.ts` (New or Modify): Create or update a repository to handle database operations for updating the `avatar_url` in the `profiles` table.

## 6. Subtasks

| Task                                                                        | File(s) / Component(s)                               | Assignee  | Est. Hours |
| --------------------------------------------------------------------------- | ---------------------------------------------------- | --------- | ---------- |
| **BE**: Create `avatars` bucket in Supabase & set RLS policies              | Supabase Dashboard                                   | Backend   | 1h         |
| **BE**: Implement `avatar-service.ts` for Supabase Storage operations       | `main-app/lib/services/avatar-service.ts`            | Backend   | 2h         |
| **BE**: Implement `profile-repository.ts` to update `avatar_url`            | `main-app/lib/repositories/profile-repository.ts`    | Backend   | 1.5h       |
| **BE**: Create/update server action in `settings.ts` for upload logic       | `main-app/lib/actions/settings.ts`                   | Fullstack | 2h         |
| **FE**: Create a reusable avatar upload component with preview & validation | `main-app/components/forms/avatar-upload.tsx` (New)  | Frontend  | 4h         |
| **FE**: Integrate avatar upload component into buyer profile form           | `main-app/components/forms/user-profile-form.tsx`    | Frontend  | 1h         |
| **FE**: Integrate avatar upload component into seller settings form         | `main-app/components/forms/seller-settings-form.tsx` | Frontend  | 1h         |
| **QA**: Manual testing of all acceptance criteria                           | Staging Environment                                  | QA        | 2h         |

## 7. Out of Scope

- In-app image editing (cropping, rotating, filters).
- Avatar moderation or approval workflows.
- Generating avatars from user initials (the UI should already have a fallback for this).
- Support for animated GIFs or other file formats.

## 8. Dependencies

- **Blocked by**: None.
- **Blocks**: None.

## 9. Definition of Done

- [ ] All acceptance criteria are met.
- [ ] RLS policies for the `avatars` bucket are implemented and tested.
- [ ] Both buyers and sellers can upload, replace, and remove their avatars.
- [ ] Client-side and server-side validation for file type and size are working.
- [ ] The avatar URL is correctly saved to the `profiles` table.
- [ ] The UI correctly displays loading and error states.
- [ ] The old avatar file is deleted from storage when a new one is uploaded.
- [ ] Code is reviewed, merged to the main branch, and deployed to staging.
```
