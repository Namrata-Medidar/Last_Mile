# Customer, Field Engineer, and Project Team ER Diagrams

Based on the checked-in SQL migrations and generated Supabase types, not a live database inspection.

## Reading the Diagrams

- `PK`: primary key; `FK`: foreign key verified in migrations; `UK`: verified unique key.
- Attribute comments say `nullable` where the generated types allow null.
- Relationships labeled `logical` are application links, not verified foreign keys.
- Relationships labeled `unverified` are used by application SQL, but their table-creation migrations were not found.
- Solid/dotted Mermaid lines normally mean identifying/non-identifying relationships. They are not used here as a foreign-key verification legend; read the relationship labels and attribute markers.
- `auth_users` represents Supabase `auth.users`. Only its referenced `id` is shown, not the complete Supabase-managed schema.
- Repeated entities in later diagrams show workflow-relevant columns. Their complete column lists appear in their first diagram.

## 1. Customer

```mermaid
erDiagram
    auth_users ||--o| profiles : "id FK"
    auth_users ||..o{ bookings : "logical customer_id"
    profiles ||--o| customer_cancellation_policies : "customer_id FK"
    profiles }o..o{ customer_details : "logical company text match"
    customer_details |o..o{ bookings : "logical details.store_id JSON"
    bookings ||..o{ booking_attachments : "booking_id FK"
    bookings ||..o{ booking_comments : "booking_id FK"
    bookings ||..o{ booking_events : "booking_id FK"
    bookings ||..o{ payments : "booking_id FK"
    bookings |o..o{ notifications : "booking_id FK nullable"
    auth_users ||..o{ notifications : "logical user_id"

    auth_users {
        uuid id PK
    }
    profiles {
        uuid id PK,FK
        text full_name "nullable"
        text email "nullable"
        text phone "nullable"
        text company "nullable"
        text address "nullable"
        text avatar_url "nullable"
        text status
        timestamptz created_at
        timestamptz updated_at
        uuid created_by "nullable"
        uuid updated_by "nullable"
    }
    customer_details {
        uuid id PK
        text company "nullable in generated types; original DDL says NOT NULL"
        text store_code UK
        text city "nullable"
        text store_name "nullable"
        text poc "nullable"
        text poc_no "nullable"
        text address "nullable"
        text priority "nullable"
        text site_readiness "nullable"
        text status "nullable"
        timestamptz created_at "nullable"
    }
    customer_cancellation_policies {
        uuid customer_id PK,FK
        numeric fee
        numeric free_hours
        text anchor
        timestamptz created_at
        timestamptz updated_at
        uuid created_by "nullable"
        uuid updated_by "nullable"
    }
    bookings {
        uuid id PK
        text ticket_no UK
        uuid customer_id "logical auth.users.id; no verified FK"
        text customer_name "nullable"
        text service_slug
        text title
        text priority
        text city "nullable"
        text site_address "nullable"
        uuid engineer_id FK "nullable; references engineers.id"
        text engineer_name
        text engineer_phone "nullable"
        integer progress
        text status
        numeric total "nullable"
        jsonb details
        text last_contact "nullable"
        integer customer_rating "nullable"
        text customer_feedback "nullable"
        timestamptz started_at "nullable"
        timestamptz completed_at "nullable"
        text payment_status
        numeric amount_paid
        text invoice_no "nullable"
        timestamptz created_at
        timestamptz updated_at
        uuid created_by "nullable"
        uuid updated_by "nullable"
    }
    booking_attachments {
        uuid id PK
        uuid booking_id FK
        text file_name
        text storage_path
        bigint file_size "nullable"
        text content_type "nullable"
        timestamptz uploaded_at
    }
    booking_comments {
        uuid id PK
        uuid booking_id FK
        uuid author_id "logical auth.users.id"
        text author_name
        text author_role
        text visibility
        text body
        text status
        timestamptz created_at
        timestamptz updated_at
        uuid created_by "nullable"
        uuid updated_by "nullable"
    }
    booking_events {
        uuid id PK
        uuid booking_id FK
        text event
        text from_status "nullable"
        text to_status "nullable"
        text note "nullable"
        text status
        timestamptz created_at
        timestamptz updated_at
        uuid created_by "nullable"
        uuid updated_by "nullable"
    }
    payments {
        uuid id PK
        uuid booking_id FK
        text kind
        numeric amount
        text method
        text reference "nullable"
        text note "nullable"
        text status
        timestamptz created_at
        timestamptz updated_at
        uuid created_by "nullable"
        uuid updated_by "nullable"
    }
    notifications {
        uuid id PK
        uuid user_id "logical auth.users.id"
        uuid booking_id FK "nullable"
        text channel
        text event
        text title
        text detail "nullable"
        timestamptz read_at "nullable"
        text status
        timestamptz created_at
        timestamptz updated_at
        uuid created_by "nullable"
        uuid updated_by "nullable"
    }
```

### Booking JSON Is Not a Separate Table

`bookings.details` stores these application properties rather than relational columns:

`clientRequestId`, `level`, `count`, `priority`, `customerType`, `customer`, `gst`, `totalPayable`, `start_date`, `end_date`, `duration`, `hours`, `startTime`, `gpsLocation`, `site`, `contacts`, `store_id`, `store_code`, `store_name`, `poc`, `poc_no`, `address`, `issueDescription`, `workInstructions`.

`site` contains `id`, `code`, `name`, and `address`; each `contacts` element contains `name` and `mobile`. These JSON references have no foreign-key enforcement. New-customer bookings can have no stored site ID.

Files are stored in the private Supabase Storage bucket `booking-attachments`. `booking_attachments.storage_path` identifies the object; it is not a verified FK to `storage.objects`.

## 2. Field Engineer

```mermaid
erDiagram
    auth_users |o..o| engineers : "logical unique nullable user_id"
    engineers |o..o{ bookings : "engineer_id FK nullable"
    bookings ||..o{ booking_events : "booking_id FK"
    bookings ||..o{ booking_comments : "booking_id FK"
    bookings ||..o{ booking_attachments : "booking_id FK"
    bookings |o..o{ notifications : "booking_id FK nullable"
    auth_users ||..o{ notifications : "logical user_id"

    auth_users {
        uuid id PK
    }
    engineers {
        uuid id PK
        uuid user_id UK "nullable; no verified FK"
        text full_name
        text phone "nullable"
        text grade
        text mode
        text city
        text kit "nullable"
        text approval_status
        boolean available
        integer max_active_jobs
        numeric rating
        integer ratings_count
        text status
        timestamptz created_at
        timestamptz updated_at
        uuid created_by "nullable"
        uuid updated_by "nullable"
    }
    bookings {
        uuid id PK
        text ticket_no UK
        uuid customer_id
        uuid engineer_id FK "nullable"
        text engineer_name
        text engineer_phone "nullable"
        text priority
        text status
        integer progress
        text site_address "nullable"
        jsonb details
        timestamptz started_at "nullable"
        timestamptz completed_at "nullable"
        integer customer_rating "nullable"
        text customer_feedback "nullable"
    }
    booking_events {
        uuid id PK
        uuid booking_id FK
        text event
        text from_status "nullable"
        text to_status "nullable"
        text note "nullable"
        timestamptz created_at
    }
    booking_comments {
        uuid id PK
        uuid booking_id FK
        uuid author_id
        text author_role
        text visibility
        text body
        timestamptz created_at
    }
    booking_attachments {
        uuid id PK
        uuid booking_id FK
        text file_name
        text storage_path
        bigint file_size "nullable"
        text content_type "nullable"
        timestamptz uploaded_at
    }
    notifications {
        uuid id PK
        uuid user_id
        uuid booking_id FK "nullable"
        text event
        text title
        timestamptz read_at "nullable"
    }
```

- One engineer can be assigned many bookings; a booking has zero or one assigned engineer.
- `bookings.details.count` can request multiple engineers, but there is no booking-engineer junction table in the inspected schema.
- Assignment and job actions are controlled by database functions, not direct client writes to protected lifecycle fields.
- Booking statuses include `Open`, `Assigned`, `In Progress`, `Closed`, and `Cancelled`.
- `bookings.customer_rating` and `customer_feedback` hold per-booking feedback. `engineers.rating` and `ratings_count` hold engineer aggregates.

## 3. Project Team

There is no separate project team or team-membership table in the inspected schema. Team access is modeled through user roles and permissions.

```mermaid
erDiagram
    auth_users ||--o| profiles : "id FK"
    auth_users ||..o{ user_roles : "user_id FK"
    roles |o..o{ user_roles : "unverified role_id relationship"
    roles ||..o{ role_permissions : "unverified role_id relationship"
    permissions ||..o{ role_permissions : "unverified permission_id relationship"
    auth_users |o..o{ audit_logs : "logical nullable actor_id"
    auth_users ||..o{ booking_comments : "logical author_id"
    bookings ||..o{ booking_comments : "booking_id FK"
    bookings ||..o{ booking_events : "booking_id FK"
    bookings ||..o{ payments : "booking_id FK"

    auth_users {
        uuid id PK
    }
    profiles {
        uuid id PK,FK
        text full_name "nullable"
        text email "nullable"
        text company "nullable"
        text status
    }
    user_roles {
        uuid id PK
        uuid user_id FK
        app_role role "nullable; legacy enum"
        uuid role_id "nullable; FK unverified"
        text status
        timestamptz created_at
        timestamptz updated_at
        uuid created_by "nullable"
        uuid updated_by "nullable"
    }
    roles {
        uuid id "expected PK; DDL unavailable"
        text name
        text slug
        text description "nullable"
        boolean is_active
        boolean is_system
        timestamptz created_at
        timestamptz updated_at
    }
    permissions {
        uuid id "expected PK; DDL unavailable"
        text code
        text module
        text description "nullable"
        timestamptz created_at
    }
    role_permissions {
        uuid id "expected PK; DDL unavailable"
        uuid role_id "FK unverified"
        uuid permission_id "FK unverified"
        timestamptz created_at
    }
    audit_logs {
        uuid id PK
        uuid actor_id "nullable; logical auth.users.id"
        text action
        text entity
        text entity_id "nullable; polymorphic reference, not FK"
        jsonb old_data "nullable"
        jsonb new_data "nullable"
        text status
        timestamptz created_at
        timestamptz updated_at
        uuid created_by "nullable"
        uuid updated_by "nullable"
    }
    bookings {
        uuid id PK
        text ticket_no UK
        uuid customer_id
        uuid engineer_id FK "nullable"
        text status
        text priority
        numeric total "nullable"
        text payment_status
        numeric amount_paid
        text invoice_no "nullable"
    }
    booking_comments {
        uuid id PK
        uuid booking_id FK
        uuid author_id
        text author_name
        text author_role
        text visibility
        text body
    }
    booking_events {
        uuid id PK
        uuid booking_id FK
        text event
        text from_status "nullable"
        text to_status "nullable"
        uuid created_by "nullable"
        timestamptz created_at
    }
    payments {
        uuid id PK
        uuid booking_id FK
        text kind
        numeric amount
        text method
        text reference "nullable"
        uuid created_by "nullable"
    }
```

- `user_roles` associates users with roles. The generated schema has both legacy `role` and nullable `role_id` columns.
- `role_permissions` logically implements the many-to-many role/permission relationship.
- SQL helpers join these tables and check active roles and permissions. Their creation DDL and FK constraints were not found in the repository, so these constraints are not asserted here.
- Permissions authorize operations; they are not ownership relationships to particular booking rows or project records.
- Payments and refunds are recorded through `record_payment`. Invoice number and payment summary live on `bookings`; no separate invoice table was found.

## Scope and Sources

These are workflow-focused diagrams, not the complete application database. Catalog/configuration tables such as `services`, `rate_cards`, `priorities`, `materials`, and `system_settings` are outside these three views.

- [Generated table columns](src/integrations/supabase/types.ts)
- [User profiles, roles, and audit schema](drizzle/migrations/0000_migration.sql)
- [Bookings, comments, events, and notifications](drizzle/migrations/0001_bookings_tracking_notifications.sql)
- [Engineer schema and assignment foreign key](drizzle/migrations/0002_engineers_assignment.sql)
- [Payment schema](drizzle/migrations/0006_payments_invoices.sql)
- [Attachment schema](drizzle/migrations/0008_booking_attachments.sql)
- [Role and permission SQL joins](drizzle/migrations/0009_permission_based_access.sql)
- [Customer site schema](drizzle/migrations/0017_create_customer_details_table.sql)
- [Customer cancellation policy schema](drizzle/migrations/0020_customer_cancellation_policies.sql)
- [Assignment acceptance and booking statuses](drizzle/migrations/0041_engineer_assignment_acceptance.sql)