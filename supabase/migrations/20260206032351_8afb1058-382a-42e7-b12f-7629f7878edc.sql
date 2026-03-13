-- Step 1: Drop existing foreign key constraints
ALTER TABLE document_request_items DROP CONSTRAINT IF EXISTS document_request_items_request_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_request_id_fkey;

-- Step 2: Rename primary key columns in all tables

-- Rename students.id to student_id
ALTER TABLE students RENAME COLUMN id TO student_id;

-- Rename admins.id to admin_id
ALTER TABLE admins RENAME COLUMN id TO admin_id;

-- Rename document_requests.id to document_request_id
ALTER TABLE document_requests RENAME COLUMN id TO document_request_id;

-- Rename document_request_items.id to document_request_item_id
ALTER TABLE document_request_items RENAME COLUMN id TO document_request_item_id;

-- Rename feedback.id to feedback_id
ALTER TABLE feedback RENAME COLUMN id TO feedback_id;

-- Rename payments.id to payment_id
ALTER TABLE payments RENAME COLUMN id TO payment_id;

-- Rename announcements.id to announcement_id
ALTER TABLE announcements RENAME COLUMN id TO announcement_id;

-- Step 3: Recreate foreign key constraints with updated references
ALTER TABLE document_request_items 
  ADD CONSTRAINT document_request_items_request_id_fkey 
  FOREIGN KEY (request_id) REFERENCES document_requests(document_request_id);

ALTER TABLE payments 
  ADD CONSTRAINT payments_request_id_fkey 
  FOREIGN KEY (request_id) REFERENCES document_requests(document_request_id);