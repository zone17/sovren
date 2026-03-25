# 📊 Mermaid Diagram Guide

## 📋 Overview

This document provides a comprehensive guide for creating Mermaid diagrams for Sovren user story implementations. Mermaid diagrams are **mandatory** for all user story implementations and must follow the standards outlined in this guide to achieve elite engineering status.

## 🎯 Diagram Types and Requirements

### Required Diagram Types

```mermaid
graph TD
    A[Mermaid Diagrams] --> B[Architecture Overview]
    A --> C[Component Interaction]
    A --> D[Data Flow]
    A --> E[Process Flow]
    A --> F[Implementation-Specific]

    B --> B1[System Context]
    C --> C1[Component Dependencies]
    D --> D1[Data Transformation]
    E --> E1[User/System Interactions]
    F --> F1[Database Schema]
    F --> F2[State Machine]
    F --> F3[Network Topology]
    F --> F4[Security Flow]

    style A fill:#e1f5fe
    style B fill:#e8f5e8
    style F fill:#fff3e0
```

## 📊 Diagram Creation Guidelines

### 1. Architecture Overview Diagram

```mermaid
graph TD
    subgraph "System Context"
        A[Frontend Application] --> B[API Gateway]
        B --> C[Backend Services]
        C --> D[Database]
        C --> E[External Services]
    end

    subgraph "Implementation Focus"
        B --> F[New Feature Component]
        F --> G[Existing Service]
        F --> H[New Service]
    end

    style F fill:#e8f5e8
    style H fill:#e8f5e8
```

**Purpose**: Illustrate where the implementation fits within the overall system architecture.

**Requirements**:

- Show the major components involved in the implementation
- Highlight new or modified components
- Show relationships between components
- Use clear, descriptive labels for all components
- Use color coding to distinguish new/modified components

**When to Create**: At the beginning of the implementation, after requirements analysis.

### 2. Component Interaction Diagram

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API
    participant Service
    participant Database

    User->>Frontend: Initiate action
    Frontend->>API: API request
    API->>Service: Process request
    Service->>Database: Query data
    Database-->>Service: Return data
    Service-->>API: Return result
    API-->>Frontend: Display result
    Frontend-->>User: Show confirmation
```

**Purpose**: Show how components interact with each other during the execution of a feature.

**Requirements**:

- Use sequence diagrams to show the flow of interactions
- Include all components involved in the interaction
- Show the sequence of operations in chronological order
- Include error handling paths where appropriate
- Use clear, descriptive messages for each interaction

**When to Create**: During technical design, after identifying all components.

### 3. Data Flow Diagram

```mermaid
graph LR
    A[User Input] --> B[Validation Layer]
    B --> C[Business Logic]
    C --> D[Data Transformation]
    D --> E[Storage Layer]
    E --> F[Database]

    C --> G[External API]
    G --> H[External Service]
    H --> I[Response Processing]
    I --> C

    style A fill:#e1f5fe
    style E fill:#e8f5e8
    style H fill:#fff3e0
```

**Purpose**: Visualize how data flows through the system during the execution of a feature.

**Requirements**:

- Show the path of data through the system
- Include data transformation steps
- Show data storage points
- Include external data sources/destinations
- Use clear, descriptive labels for data elements

**When to Create**: During technical design, when defining data models and flows.

### 4. Process Flow Diagram

```mermaid
graph TD
    A[Start] --> B{User Authenticated?}
    B -->|Yes| C[Load User Data]
    B -->|No| D[Redirect to Login]

    C --> E{Data Valid?}
    E -->|Yes| F[Process Request]
    E -->|No| G[Show Error]

    F --> H{Operation Successful?}
    H -->|Yes| I[Show Success]
    H -->|No| J[Show Error]

    I --> K[End]
    J --> K
    G --> K
    D --> K

    style A fill:#e1f5fe
    style F fill:#e8f5e8
    style J fill:#ffebee
```

**Purpose**: Provide a step-by-step visualization of the process flow, including decision points and error handling.

**Requirements**:

- Show the complete process flow from start to end
- Include all decision points with clear conditions
- Show error handling paths
- Use consistent symbols for different types of steps
- Use clear, descriptive labels for all steps

**When to Create**: During technical design, when defining the process flow.

### 5. Implementation-Specific Diagrams

#### Database Schema Diagram

```mermaid
erDiagram
    USER {
        string id PK
        string username
        string email
        string hashedPassword
        datetime createdAt
        datetime updatedAt
    }

    CONTENT {
        string id PK
        string userId FK
        string title
        string body
        string type
        string status
        array tags
        datetime createdAt
        datetime updatedAt
    }

    PAYMENT {
        string id PK
        string userId FK
        number amount
        string status
        string paymentRequest
        string paymentHash
        datetime createdAt
    }

    USER ||--o{ CONTENT : "creates"
    USER ||--o{ PAYMENT : "receives"
```

**Purpose**: Visualize database schema changes or relationships.

**Requirements**:

- Show all relevant tables and their relationships
- Include field names and types
- Highlight primary and foreign keys
- Show cardinality of relationships
- Highlight new or modified tables/fields

**When to Create**: When implementing features that involve database changes.

#### State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> InReview: Submit
    InReview --> Draft: Request Changes
    InReview --> Approved: Approve
    Approved --> Published: Publish
    Published --> Archived: Archive
    Archived --> [*]

    Draft --> Deleted: Delete
    InReview --> Deleted: Delete
    Deleted --> [*]
```

**Purpose**: Visualize state transitions for entities with complex lifecycle management.

**Requirements**:

- Show all possible states
- Include all valid transitions between states
- Label transitions with the events that trigger them
- Include initial and final states
- Use clear, descriptive names for states and transitions

**When to Create**: When implementing features with complex state management.

#### Network Topology Diagram

```mermaid
graph TD
    subgraph "Public Zone"
        A[CDN] --> B[Load Balancer]
        B --> C[API Gateway]
    end

    subgraph "Private Zone"
        C --> D[Web Servers]
        D --> E[Application Servers]
        E --> F[Database Servers]
    end

    subgraph "External Services"
        E --> G[Payment Processor]
        E --> H[Email Service]
    end

    style A fill:#e1f5fe
    style F fill:#e8f5e8
```

**Purpose**: Visualize network architecture and security zones.

**Requirements**:

- Show all network components and their connections
- Group components into logical zones
- Show traffic flow between components
- Include security boundaries
- Use clear, descriptive labels for all components

**When to Create**: When implementing features that involve infrastructure or network changes.

#### Security Flow Diagram

```mermaid
graph TD
    A[User] --> B[Authentication Request]
    B --> C{Valid Credentials?}

    C -->|Yes| D[Generate JWT]
    C -->|No| E[Return Error]

    D --> F[Set Rate Limiting]
    F --> G[Apply Role-Based Access]
    G --> H[Return Token]

    H --> I[Subsequent Requests]
    I --> J{Valid Token?}

    J -->|Yes| K[Authorize Request]
    J -->|No| L[Return 401 Error]

    K --> M{Has Permission?}
    M -->|Yes| N[Process Request]
    M -->|No| O[Return 403 Error]

    style D fill:#e8f5e8
    style K fill:#e8f5e8
    style L fill:#ffebee
    style O fill:#ffebee
```

**Purpose**: Visualize security flows, including authentication, authorization, and data protection.

**Requirements**:

- Show the complete security flow
- Include authentication and authorization steps
- Show validation and verification points
- Include error handling for security failures
- Use clear, descriptive labels for all steps

**When to Create**: When implementing features that involve security concerns.

## 🛠️ Mermaid Syntax Guide

### Basic Syntax

Mermaid diagrams are defined using a simple markdown-like syntax:

````
```mermaid
graph TD
    A[Start] --> B[End]
```
````

### Common Diagram Types

#### Flowchart

```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
```

**Syntax**:

```
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
```

#### Sequence Diagram

```mermaid
sequenceDiagram
    participant A as Service A
    participant B as Service B

    A->>B: Request Data
    B-->>A: Return Data

    A->>A: Process Data
```

**Syntax**:

```
sequenceDiagram
    participant A as Service A
    participant B as Service B

    A->>B: Request Data
    B-->>A: Return Data

    A->>A: Process Data
```

#### Entity Relationship Diagram

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
```

**Syntax**:

```
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
```

#### State Diagram

```mermaid
stateDiagram-v2
    [*] --> Active
    Active --> Inactive
    Inactive --> Active
    Inactive --> [*]
```

**Syntax**:

```
stateDiagram-v2
    [*] --> Active
    Active --> Inactive
    Inactive --> Active
    Inactive --> [*]
```

#### Class Diagram

```mermaid
classDiagram
    class Animal {
        +String name
        +move()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog
```

**Syntax**:

```
classDiagram
    class Animal {
        +String name
        +move()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog
```

### Styling and Formatting

#### Node Shapes

```mermaid
graph TD
    A[Rectangle] --> B(Rounded Rectangle)
    B --> C{Diamond}
    C --> D((Circle))
    D --> E>Asymmetric]
    E --> F[[Database]]
```

**Syntax**:

```
graph TD
    A[Rectangle] --> B(Rounded Rectangle)
    B --> C{Diamond}
    C --> D((Circle))
    D --> E>Asymmetric]
    E --> F[[Database]]
```

#### Styling Nodes

```mermaid
graph TD
    A[Node A] --> B[Node B]

    style A fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    style B fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
```

**Syntax**:

```
graph TD
    A[Node A] --> B[Node B]

    style A fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    style B fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
```

#### Subgraphs

```mermaid
graph TD
    subgraph Group A
        A[Node A] --> B[Node B]
    end

    subgraph Group B
        C[Node C] --> D[Node D]
    end

    B --> C
```

**Syntax**:

```
graph TD
    subgraph Group A
        A[Node A] --> B[Node B]
    end

    subgraph Group B
        C[Node C] --> D[Node D]
    end

    B --> C
```

## 📚 Tools and Resources

### Online Editors

- [Mermaid Live Editor](https://mermaid.live/) - Interactive editor with live preview
- [Mermaid.js Online Editor](https://mermaid-js.github.io/mermaid-live-editor/) - Official editor

### IDE Plugins

- **VS Code**: [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid)
- **JetBrains**: [Mermaid](https://plugins.jetbrains.com/plugin/8460-mermaid)
- **Vim/Neovim**: [Markdown Preview](https://github.com/iamcco/markdown-preview.nvim)

### Documentation

- [Mermaid.js Documentation](https://mermaid-js.github.io/mermaid/#/)
- [Mermaid Cheat Sheet](https://jojozhuang.github.io/tutorial/mermaid-cheat-sheet/)
- [GitHub Mermaid Support](https://github.blog/2022-02-14-include-diagrams-markdown-files-mermaid/)

## 📝 Best Practices

### Diagram Organization

1. **Keep Diagrams Focused**:
   - Each diagram should have a clear purpose
   - Limit complexity to maintain readability
   - Break complex diagrams into multiple simpler diagrams

2. **Use Consistent Styling**:
   - Maintain consistent node shapes for similar entities
   - Use consistent color coding across diagrams
   - Follow the project's visual style guide

3. **Provide Context**:
   - Include a title for each diagram
   - Add a brief description explaining the diagram's purpose
   - Include legends for color coding and symbols

4. **Ensure Readability**:
   - Limit the number of nodes in a single diagram
   - Use clear, descriptive labels
   - Arrange nodes to minimize crossing lines

### Diagram Review Checklist

- [ ] Diagram has a clear purpose and focus
- [ ] All required elements are included
- [ ] Relationships are correctly represented
- [ ] Labels are clear and descriptive
- [ ] Styling is consistent with project standards
- [ ] Diagram is readable and not overly complex
- [ ] Context and legends are provided where needed

## 🏆 Elite Diagram Status

Diagrams achieve **Elite Status** when they:

✅ **Clearly communicate** the intended information
✅ **Follow project standards** for styling and formatting
✅ **Include appropriate detail** without unnecessary complexity
✅ **Provide context** through titles, descriptions, and legends
✅ **Support the documentation** by visually representing key concepts

---

**MANDATORY REQUIREMENT**: Every user story implementation MUST include the required Mermaid diagrams to achieve elite engineering status. No exceptions.
