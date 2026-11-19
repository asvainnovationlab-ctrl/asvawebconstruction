-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_featuredImageId_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "project_technologies" DROP CONSTRAINT "project_technologies_projectId_fkey";

-- DropForeignKey
ALTER TABLE "project_technologies" DROP CONSTRAINT "project_technologies_technologyId_fkey";

-- DropForeignKey
ALTER TABLE "project_images" DROP CONSTRAINT "project_images_projectId_fkey";

-- DropForeignKey
ALTER TABLE "project_images" DROP CONSTRAINT "project_images_mediaId_fkey";

-- DropForeignKey
ALTER TABLE "authors" DROP CONSTRAINT "authors_avatarId_fkey";

-- DropForeignKey
ALTER TABLE "authors" DROP CONSTRAINT "authors_adminUserId_fkey";

-- DropForeignKey
ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_featuredImageId_fkey";

-- DropForeignKey
ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_authorId_fkey";

-- DropForeignKey
ALTER TABLE "blog_post_tags" DROP CONSTRAINT "blog_post_tags_postId_fkey";

-- DropForeignKey
ALTER TABLE "blog_post_tags" DROP CONSTRAINT "blog_post_tags_tagId_fkey";

-- DropForeignKey
ALTER TABLE "blog_post_revisions" DROP CONSTRAINT "blog_post_revisions_postId_fkey";

-- DropForeignKey
ALTER TABLE "blog_post_revisions" DROP CONSTRAINT "blog_post_revisions_createdById_fkey";

-- DropTable
DROP TABLE "project_categories";

-- DropTable
DROP TABLE "projects";

-- DropTable
DROP TABLE "project_technologies";

-- DropTable
DROP TABLE "project_images";

-- DropTable
DROP TABLE "authors";

-- DropTable
DROP TABLE "blog_categories";

-- DropTable
DROP TABLE "blog_tags";

-- DropTable
DROP TABLE "blog_posts";

-- DropTable
DROP TABLE "blog_post_tags";

-- DropTable
DROP TABLE "blog_post_revisions";

