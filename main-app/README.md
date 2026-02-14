# Database Schema Design - BuySmart E-Commerce Platform

## Hugging Face + LangChain Setup

### Installed dependencies

- `@huggingface/inference`
- `langchain`
- `@langchain/core`
- `@langchain/community`
- `zod`
- `@xenova/transformers`
- `ai`
- `node-fetch`

### Environment variables

Add these keys in `.env.local`:

```dotenv
HUGGINGFACE_API_KEY=your_hf_token_here
HF_LLM_MODEL=mistralai/Mixtral-8x7B-Instruct-v0.1
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
HF_SENTIMENT_MODEL=cardiffnlp/twitter-roberta-base-sentiment-latest
HF_CHAT_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
HF_CLASSIFICATION_MODEL=facebook/bart-large-mnli

AI_TEMPERATURE=0.7
AI_MAX_TOKENS=1024
AI_TOP_P=0.9

HF_INFERENCE_ENDPOINT=https://api-inference.huggingface.co/models/
HF_RATE_LIMIT_DELAY=100
HF_MAX_RETRIES=3
```

### AI service entry points

- `lib/services/ai/config.ts`
- `lib/services/ai/hf-client.ts`
- `lib/services/ai/langchain-hf.ts`
- `lib/services/ai/models/*`
- `lib/services/ai/test-connection.ts`
- `lib/services/ai/test-models.ts`
- `lib/services/ai/benchmark.ts`

### Quick validation

Use the exported functions from:

- `lib/services/ai/test-connection.ts`
- `lib/services/ai/test-models.ts`
- `lib/services/ai/benchmark.ts`

These validate connectivity, model outputs, and response latency.

**Project:** CSE327.2 - AI-Assisted E-Commerce Platform  
**Date:** February 11, 2026  
**Version:** 1.0  
**Database:** PostgreSQL with Supabase

---

## 1. Entity Descriptions

### Core Business Entities

#### Users (Managed by Supabase Auth)

- **Purpose:** Store user authentication and profile information
- **Source:** Supabase built-in auth.users table extended with custom profile data
- **Key Features:** OAuth integration (Google, Facebook), email/password authentication

#### Products

- **Purpose:** Catalog of all products available for purchase
- **Features:** Multi-category classification, inventory tracking, pricing, seller association
- **AI Integration:** Used by recommendation agents for product suggestions

#### Orders

- **Purpose:** Transaction records for all purchase activities
- **Features:** Multi-item orders, status tracking, payment integration
- **Workflow:** Draft → Confirmed → Processing → Shipped → Delivered → Completed/Cancelled

#### Feedback

- **Purpose:** User reviews and ratings for products and services
- **AI Integration:** Analyzed by Feedback Analysis Agent for sentiment and categorization
- **Features:** Star ratings, text reviews, sentiment classification, issue categorization

#### Refunds

- **Purpose:** Refund and return request management
- **AI Integration:** Assisted by Refund Decision Agent for automated processing recommendations
- **Features:** Status tracking, reason codes, approval workflow

#### Activity Logs

- **Purpose:** Audit trail for system activities and AI agent actions
- **Features:** User activities, AI agent decisions, system events, security logs

---

## 2. Table Structure (Conceptual)

### users_profile (Extends Supabase auth.users)

```
Primary Key: user_id (UUID) → references auth.users(id)
Columns:
- user_id: UUID (PK, FK to auth.users)
- full_name: VARCHAR(255)
- display_name: VARCHAR(100)
- avatar_url: TEXT
- phone: VARCHAR(20)
- address: JSONB
- role: USER_ROLE_ENUM (buyer, seller, admin)
- preferences: JSONB
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE
- is_active: BOOLEAN (default: true)
- email_verified: BOOLEAN
- profile_completed: BOOLEAN
```

### categories

```
Primary Key: category_id (SERIAL)
Columns:
- category_id: SERIAL (PK)
- name: VARCHAR(100) NOT NULL
- description: TEXT
- parent_category_id: INTEGER (FK to categories.category_id) [Self-referencing for hierarchy]
- level: INTEGER (0=root, 1=subcategory, etc.)
- is_active: BOOLEAN (default: true)
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE

Unique Constraints:
- (name, parent_category_id) - Prevent duplicate names within same parent
```

### products

```
Primary Key: product_id (UUID)
Columns:
- product_id: UUID (PK)
- seller_id: UUID (FK to users_profile.user_id)
- category_id: INTEGER (FK to categories.category_id)
- name: VARCHAR(255) NOT NULL
- description: TEXT
- short_description: VARCHAR(500)
- price: DECIMAL(10,2) NOT NULL
- compare_at_price: DECIMAL(10,2)
- cost_price: DECIMAL(10,2)
- sku: VARCHAR(100) UNIQUE
- barcode: VARCHAR(100)
- inventory_quantity: INTEGER (default: 0)
- inventory_tracked: BOOLEAN (default: true)
- weight: DECIMAL(8,2)
- dimensions: JSONB {length, width, height, unit}
- images: JSONB (array of image URLs)
- tags: TEXT[] (array for search optimization)
- meta_data: JSONB (variant info, specifications)
- status: PRODUCT_STATUS_ENUM (draft, active, inactive, archived)
- featured: BOOLEAN (default: false)
- seo_title: VARCHAR(255)
- seo_description: TEXT
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE

Indexes:
- (seller_id, status)
- (category_id, status)
- (name) using GIN for full-text search
- (tags) using GIN array search
```

### orders

```
Primary Key: order_id (UUID)
Columns:
- order_id: UUID (PK)
- buyer_id: UUID (FK to users_profile.user_id)
- order_number: VARCHAR(50) UNIQUE NOT NULL (human-readable)
- status: ORDER_STATUS_ENUM (draft, confirmed, processing, shipped, delivered, completed, cancelled)
- subtotal: DECIMAL(10,2) NOT NULL
- tax_amount: DECIMAL(10,2) (default: 0)
- shipping_amount: DECIMAL(10,2) (default: 0)
- discount_amount: DECIMAL(10,2) (default: 0)
- total_amount: DECIMAL(10,2) NOT NULL
- currency: VARCHAR(3) (default: 'USD')
- payment_status: PAYMENT_STATUS_ENUM (pending, paid, failed, refunded, partially_refunded)
- payment_method: VARCHAR(50)
- payment_reference: VARCHAR(255)
- shipping_address: JSONB {street, city, state, postal_code, country}
- billing_address: JSONB
- notes: TEXT
- tracking_number: VARCHAR(255)
- shipped_at: TIMESTAMP WITH TIME ZONE
- delivered_at: TIMESTAMP WITH TIME ZONE
- completed_at: TIMESTAMP WITH TIME ZONE
- cancelled_at: TIMESTAMP WITH TIME ZONE
- cancellation_reason: TEXT
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE

Indexes:
- (buyer_id, status)
- (order_number)
- (status, created_at)
```

### order_items

```
Primary Key: order_item_id (UUID)
Columns:
- order_item_id: UUID (PK)
- order_id: UUID (FK to orders.order_id)
- product_id: UUID (FK to products.product_id)
- seller_id: UUID (FK to users_profile.user_id)
- quantity: INTEGER NOT NULL (CHECK quantity > 0)
- unit_price: DECIMAL(10,2) NOT NULL
- total_price: DECIMAL(10,2) NOT NULL
- product_snapshot: JSONB (name, description, image at time of order)
- status: ORDER_ITEM_STATUS_ENUM (pending, confirmed, shipped, delivered, returned)
- created_at: TIMESTAMP WITH TIME ZONE

Constraints:
- total_price = quantity * unit_price (enforced by trigger)
- Unique (order_id, product_id) - prevent duplicate products in same order

Indexes:
- (order_id)
- (product_id)
- (seller_id)
```

### feedback

```
Primary Key: feedback_id (UUID)
Columns:
- feedback_id: UUID (PK)
- user_id: UUID (FK to users_profile.user_id)
- product_id: UUID (FK to products.product_id, nullable)
- order_id: UUID (FK to orders.order_id, nullable)
- order_item_id: UUID (FK to order_items.order_item_id, nullable)
- feedback_type: FEEDBACK_TYPE_ENUM (product_review, seller_review, service_feedback, general)
- rating: INTEGER CHECK (rating >= 1 AND rating <= 5)
- title: VARCHAR(255)
- comment: TEXT
- images: JSONB (array of image URLs)
- is_verified_purchase: BOOLEAN (default: false)
-
-- AI Analysis Fields (populated by AI agents)
- ai_sentiment: AI_SENTIMENT_ENUM (positive, neutral, negative, mixed)
- ai_category: AI_FEEDBACK_CATEGORY_ENUM (product_quality, delivery, customer_service, pricing, other)
- ai_urgency: AI_URGENCY_ENUM (low, medium, high, critical)
- ai_keywords: TEXT[]
- ai_processed_at: TIMESTAMP WITH TIME ZONE
- ai_confidence_score: DECIMAL(3,2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 1)

- status: FEEDBACK_STATUS_ENUM (draft, published, hidden, flagged, archived)
- is_helpful: INTEGER (default: 0) -- helpful vote count
- is_reported: BOOLEAN (default: false)
- moderated_at: TIMESTAMP WITH TIME ZONE
- moderator_id: UUID (FK to users_profile.user_id, nullable)
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE

Constraints:
- At least one of product_id, order_id must be provided for product/service feedback
- Unique (user_id, product_id, order_item_id) - one review per product per order

Indexes:
- (product_id, status, rating)
- (user_id, feedback_type)
- (ai_sentiment, ai_category)
- (created_at DESC)
```

### refunds

```
Primary Key: refund_id (UUID)
Columns:
- refund_id: UUID (PK)
- refund_number: VARCHAR(50) UNIQUE NOT NULL
- order_id: UUID (FK to orders.order_id)
- order_item_id: UUID (FK to order_items.order_item_id, nullable)
- user_id: UUID (FK to users_profile.user_id)
- refund_type: REFUND_TYPE_ENUM (full_order, partial_order, single_item)
- reason_code: REFUND_REASON_ENUM (damaged, wrong_item, not_as_described, changed_mind, duplicate_order, other)
- reason_description: TEXT
- refund_amount: DECIMAL(10,2) NOT NULL
- requested_amount: DECIMAL(10,2) NOT NULL
- status: REFUND_STATUS_ENUM (pending, ai_review, manual_review, approved, processing, completed, rejected, cancelled)
-
-- AI Decision Support Fields
- ai_recommendation: AI_REFUND_DECISION_ENUM (auto_approve, manual_review, auto_reject)
- ai_risk_score: DECIMAL(3,2) CHECK (ai_risk_score >= 0 AND ai_risk_score <= 1)
- ai_analysis: JSONB {confidence, factors, notes}
- ai_processed_at: TIMESTAMP WITH TIME ZONE

- evidence_images: JSONB (array of uploaded evidence URLs)
- return_required: BOOLEAN (default: false)
- return_tracking: VARCHAR(255)
- return_received_at: TIMESTAMP WITH TIME ZONE
-
- processed_by: UUID (FK to users_profile.user_id, nullable)
- processed_at: TIMESTAMP WITH TIME ZONE
- processing_notes: TEXT
- payment_reference: VARCHAR(255)
- refunded_at: TIMESTAMP WITH TIME ZONE
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE

Indexes:
- (user_id, status)
- (order_id, status)
- (status, created_at)
- (ai_recommendation, status)
```

### activity_logs

```
Primary Key: log_id (UUID)
Columns:
- log_id: UUID (PK)
- user_id: UUID (FK to users_profile.user_id, nullable)
- session_id: UUID (nullable)
- activity_type: ACTIVITY_TYPE_ENUM (auth, product_view, search, order, payment, feedback, refund, ai_action, system_event)
- entity_type: VARCHAR(50) (products, orders, feedback, refunds, users)
- entity_id: UUID (generic reference to any entity)
- action: VARCHAR(100) (login, view, create, update, delete, recommend, analyze, etc.)
-
-- AI Agent Specific Fields
- agent_name: VARCHAR(100) (recommendation_agent, feedback_agent, refund_agent, support_agent)
- agent_version: VARCHAR(20)
- model_used: VARCHAR(100)
- input_data: JSONB (sanitized input provided to agent)
- output_data: JSONB (agent response/recommendation)
- confidence_score: DECIMAL(3,2)
- processing_time_ms: INTEGER
-
- ip_address: INET
- user_agent: TEXT
- metadata: JSONB (additional context data)
- severity: LOG_SEVERITY_ENUM (info, warning, error, critical)
- status: LOG_STATUS_ENUM (success, failure, partial)
- error_message: TEXT
- created_at: TIMESTAMP WITH TIME ZONE

Indexes:
- (user_id, created_at DESC)
- (activity_type, created_at DESC)
- (agent_name, created_at DESC)
- (entity_type, entity_id)
- (created_at DESC) -- for general log browsing
```

### ai_model_configs

```
Primary Key: config_id (SERIAL)
Columns:
- config_id: SERIAL (PK)
- agent_name: VARCHAR(100) NOT NULL
- model_name: VARCHAR(100) NOT NULL
- version: VARCHAR(20) NOT NULL
- configuration: JSONB (model parameters, thresholds)
- is_active: BOOLEAN (default: true)
- performance_metrics: JSONB (accuracy, response_time stats)
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE

Unique Constraints:
- (agent_name, is_active) WHERE is_active = true -- only one active config per agent
```

---

## 3. Status Enums (Conceptual Definitions)

```sql
-- User and Access Control
USER_ROLE_ENUM: 'buyer', 'seller', 'admin', 'moderator'

-- Product Management
PRODUCT_STATUS_ENUM: 'draft', 'active', 'inactive', 'out_of_stock', 'archived'

-- Order Workflow
ORDER_STATUS_ENUM: 'draft', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'
ORDER_ITEM_STATUS_ENUM: 'pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled'
PAYMENT_STATUS_ENUM: 'pending', 'paid', 'failed', 'refunded', 'partially_refunded'

-- Feedback and AI Analysis
FEEDBACK_TYPE_ENUM: 'product_review', 'seller_review', 'service_feedback', 'general_feedback'
FEEDBACK_STATUS_ENUM: 'draft', 'published', 'hidden', 'flagged', 'archived'
AI_SENTIMENT_ENUM: 'positive', 'neutral', 'negative', 'mixed'
AI_FEEDBACK_CATEGORY_ENUM: 'product_quality', 'delivery', 'customer_service', 'pricing', 'user_experience', 'other'
AI_URGENCY_ENUM: 'low', 'medium', 'high', 'critical'

-- Refund Management
REFUND_TYPE_ENUM: 'full_order', 'partial_order', 'single_item'
REFUND_REASON_ENUM: 'damaged', 'defective', 'wrong_item', 'not_as_described', 'size_issue', 'changed_mind', 'duplicate_order', 'late_delivery', 'other'
REFUND_STATUS_ENUM: 'pending', 'ai_review', 'manual_review', 'approved', 'processing', 'completed', 'rejected', 'cancelled'
AI_REFUND_DECISION_ENUM: 'auto_approve', 'manual_review', 'auto_reject'

-- System Logging
ACTIVITY_TYPE_ENUM: 'auth', 'product_view', 'search', 'cart', 'order', 'payment', 'feedback', 'refund', 'ai_action', 'system_event', 'security_event'
LOG_SEVERITY_ENUM: 'debug', 'info', 'warning', 'error', 'critical'
LOG_STATUS_ENUM: 'success', 'failure', 'partial', 'timeout'
```

---

## 4. Relationship Diagram (Text Format)

```
auth.users (Supabase)
    ║
    ╠══ users_profile (1:1, extends auth)
    ║       ║
    ║       ╠══ products (1:many, as seller)
    ║       ║       ║
    ║       ║       ╠══ order_items (1:many)
    ║       ║       ╚══ feedback (1:many, product reviews)
    ║       ║
    ║       ╠══ orders (1:many, as buyer)
    ║       ║       ║
    ║       ║       ╠══ order_items (1:many)
    ║       ║       ╚══ refunds (1:many)
    ║       ║
    ║       ╠══ feedback (1:many, as reviewer)
    ║       ╠══ refunds (1:many, as requester)
    ║       ╚══ activity_logs (1:many, user actions)
    ║
    ╚══ activity_logs (1:many, all users)

categories (self-referencing hierarchy)
    ║
    ╚══ products (1:many)

orders ──── order_items (1:many)
    ║           ║
    ║           ║
    ╠══ refunds │
    ╚══ feedback │
                 │
                 ╚══ feedback (via product_id)

AI Models:
ai_model_configs ──── activity_logs (tracking AI decisions)
```

**Key Relationships:**

- **Users ↔ Products:** Sellers create products (1:many)
- **Users ↔ Orders:** Buyers place orders (1:many)
- **Orders ↔ Order Items:** Each order contains multiple items (1:many)
- **Products ↔ Order Items:** Products can be in multiple orders (many:many through order_items)
- **Orders ↔ Refunds:** Orders can have multiple refunds (1:many)
- **Products ↔ Feedback:** Products receive reviews (1:many)
- **Users ↔ Activity Logs:** All user actions are logged (1:many)

---

## 5. Security Model & Ownership Logic

### Data Ownership Principles

#### User Data Ownership

- **Profile Data:** Users own their profile information
- **Orders:** Buyers own their order history and details
- **Products:** Sellers own their product listings and inventory
- **Feedback:** Users own their submitted reviews and ratings
- **Refunds:** Users own their refund requests and communication

#### Admin Override Rights

- **Moderation:** Admins can moderate feedback, handle disputes
- **System Management:** Access to logs, user management, platform settings
- **Financial Oversight:** View aggregated financial data, tax reporting

#### Multi-Tenant Seller Model

- **Seller Isolation:** Sellers can only access their own products and related orders
- **Cross-Seller Data:** Order items from multiple sellers in single order
- **Revenue Tracking:** Each seller sees only their portion of multi-seller orders

### Access Control Matrix

| Role          | Users             | Products           | Orders                 | Feedback                      | Refunds         | Logs             |
| ------------- | ----------------- | ------------------ | ---------------------- | ----------------------------- | --------------- | ---------------- |
| **Buyer**     | Own profile       | Read-only (browse) | Own orders             | Own reviews + product reviews | Own refunds     | Own activity     |
| **Seller**    | Own profile       | Own products       | Related orders (items) | Product feedback              | Related refunds | Related activity |
| **Admin**     | All users         | All products       | All orders             | All feedback                  | All refunds     | All logs         |
| **Moderator** | Limited user data | Read-only          | Read-only              | Moderate all                  | Read-only       | Read-only        |

---

## 6. Row Level Security (RLS) Logic

### Authentication-Based Security

#### users_profile Table

- **Read:** Users can read their own profile + public seller profiles
- **Write:** Users can only update their own profile
- **Admin Exception:** Admins can read all profiles for moderation

#### products Table

- **Read:** Everyone can read active products; sellers can read their own (all statuses)
- **Write:** Only product owner (seller) can create/update their products
- **Delete:** Soft delete only (status = 'archived'), no hard deletes

#### orders Table

- **Read:** Buyers see their own orders; sellers see orders containing their products
- **Write:** Buyers can create/update orders in 'draft' status only
- **System Updates:** Order status updates handled by backend functions only

#### order_items Table

- **Read:** Visible to order buyer + item seller
- **Write:** System-controlled during order processing
- **Constraint:** Cannot modify items in confirmed orders

#### feedback Table

- **Read:** Public feedback visible to all; private/draft visible to author only
- **Write:** Users can create feedback for purchased products only
- **Moderation:** Moderators can update status, hide inappropriate content

#### refunds Table

- **Read:** Refund requester + related sellers + admins can view
- **Write:** Users can create refunds; status updates via backend only
- **AI Processing:** AI agents can update ai\_\* fields only

#### activity_logs Table

- **Read:** Users see their own activity; admins see all logs
- **Write:** System/application only (no user writes)
- **Data Retention:** Automatic archival after 2 years

### Security Enforcement Strategy

#### Function-Level Security

```
Check user authentication status
Validate user role and permissions
Apply entity ownership rules
Log security events for monitoring
Return filtered data based on access rights
```

#### AI Agent Security

```
AI agents operate with service role permissions
AI updates logged with audit trail
Human oversight required for high-impact decisions
Model access limited to specific data fields
No direct user data modification by AI
```

#### Session & API Security

```
JWT token validation on all requests
Rate limiting per user/IP address
Input sanitization and SQL injection prevention
CORS policy enforcement
API key authentication for external integrations
```

---

## 7. Design Justification

### Normalization Strategy

#### BCNF Compliance Decisions

- **Users Profile:** Separated from auth.users to avoid modifying Supabase core tables while maintaining 1:1 relationship
- **Order Items:** Separate table prevents order-level duplication and supports multi-seller orders
- **Categories:** Self-referencing hierarchy allows unlimited category nesting without duplication
- **AI Fields:** Embedded in feedback/refunds tables rather than separate tables to maintain atomic operations

#### Denormalization Choices

- **Product Snapshot in Order Items:** Preserves product information at time of purchase (essential for order history accuracy)
- **Address Storage as JSONB:** Flexible address formats across countries without rigid schema
- **AI Analysis Fields:** Embedded in source tables for performance and simplicity
- **Metadata as JSONB:** Product variants, specifications stored as flexible JSON for e-commerce diversity

### Performance Optimization

#### Indexing Strategy

- **Composite Indexes:** (user_id, status) patterns for efficient filtered queries
- **GIN Indexes:** Full-text search on product names, array operations on tags
- **Time-Based Indexes:** Created_at DESC for chronological browsing
- **Foreign Key Indexes:** Automatic relationship traversal optimization

#### Scalability Considerations

- **UUID Primary Keys:** Distributed system friendly, merge conflict avoidance
- **Partitioning Ready:** Large tables (logs, orders) can be partitioned by date
- **Read Replicas:** Query distribution for read-heavy operations
- **JSON Fields:** Flexible schema evolution without migrations

### AI Integration Architecture

#### Separated Concerns

- **Core Business Logic:** Traditional relational data (orders, products, users)
- **AI Enhancement:** Additional fields for AI insights without disrupting core operations
- **Audit Trail:** Complete logging of AI decisions for transparency and debugging
- **Human Oversight:** AI provides recommendations; humans make final decisions

#### Data Flow Design

```
User Action → Core Business Logic → AI Analysis → Recommendation → Human Decision → System Update → Audit Log
```

#### Reliability & Transparency

- **AI Confidence Scores:** Every AI decision includes confidence level
- **Model Versioning:** Track which AI model version made each decision
- **Input/Output Logging:** Full traceability of AI reasoning process
- **Performance Metrics:** Monitor AI accuracy and response times

### Security Architecture

#### Defense in Depth

1. **Authentication:** Supabase Auth with multi-provider OAuth
2. **Authorization:** Row Level Security policies
3. **Application Logic:** Business rule enforcement
4. **Audit Logging:** Complete activity trail
5. **Data Encryption:** At rest and in transit

#### Privacy Compliance

- **Data Minimization:** Only store necessary user information
- **Consent Tracking:** User preferences and consent status
- **Right to Erasure:** Soft delete patterns support data removal
- **Access Logs:** Complete audit trail for compliance reporting

### Business Logic Support

#### E-Commerce Workflows

- **Order Lifecycle:** Complete status tracking from creation to fulfillment
- **Multi-Seller Support:** Single orders spanning multiple sellers
- **Inventory Management:** Real-time stock tracking and reservation
- **Financial Reconciliation:** Clear money flow tracking per seller

#### AI Agent Integration

- **Recommendation Engine:** User behavior and product data analysis
- **Feedback Analysis:** Automated sentiment classification and issue detection
- **Refund Automation:** Risk scoring and automated approval for low-risk cases
- **Customer Support:** Context-aware assistance using order and product history

This schema design provides a solid foundation for a scalable, secure, and AI-enhanced e-commerce platform while maintaining clear separation between core business logic and AI augmentation features.
