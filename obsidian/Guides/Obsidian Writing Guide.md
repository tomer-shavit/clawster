---
tags: #guide #internal #obsidian #meta
purpose: Guide for Clawdbot on writing efficient Obsidian documentation
last-updated: 2026-01-26
---

# 📝 Obsidian Writing Guide for Clawdbot

## 🎯 Purpose
This guide tells **me** how to create and maintain Obsidian docs efficiently for Tomer.

## ⚡ When to Create/Edit Obsidian Docs

### ✅ TRIGGER: Create New Page
- User shares new information about themselves, projects, work
- User mentions new achievement, skill, or interest
- User asks to remember something specific
- Daily note needed for journaling

### ✅ TRIGGER: Update Existing Page
- User provides new details about existing topic
- User's situation changes (new job, new project, etc.)
- New connection discovered between pages
- User explicitly requests update

### ❌ DON'T CREATE
- For temporary, forgettable information
- For API keys or secrets (use config/env)
- Duplicate of what's already there (read first!)

---

## 🏗️ Efficient Page Structure

### 📋 Standard Template
```markdown
---
tags: #category #subcategory
key: value
created: YYYY-MM-DD
---

# Title

## 👋 About
One-sentence description.

## 💡 Key Points
- Point 1
- Point 2

## 🔗 Related Pages
[[Related Page 1]]
[[Related Page 2]]
```

### 📂 Folder Organization
```
obsidian/
├── Guides/           ← Meta-docs (this guide!)
├── People/            ← People profiles
├── Projects/          ← Projects Tomer works on
├── Skills/            ← Tech skills breakdown
├── Work/              ← Jobs/companies
├── Daily/             ← Journal entries
├── Ideas/             ← Future concepts
└── Templates/         ← Reusable templates
```

---

## 🔗 Linking Strategy (CRITICAL!)

### ✅ ALWAYS USE WIKILINKS
- Use `[[Page Name]]` format for all internal references
- Be precise: `[[Projects/CVBoost]]` not just "CVBoost"
- Create backlinks naturally: "Tomer works at [[Wix]]" → Wix page gets backlink

### 🎯 Bidirectional Linking
```markdown
# Tomer Shavit
Works at: [[Wix]]
Built: [[CVBoost]]
Uses: [[React]], [[Next.js]]

# Wix
Employee: [[Tomer Shavit]]
Tech: [[React]], [[Scala]]
```
Both pages reference each other → Obsidian graph shows connections!

### 📷 Link Density Rules
- **Every person page**: Links to their work, projects, skills
- **Every project page**: Links to creator, tech stack, related work
- **Every skill page**: Links to projects/work that use it
- **Every work page**: Links to employees, technologies used

---

## 🎨 Best Practices

### 1. One Concept Per Page
- ✅ `React.md` - everything about React
- ❌ `Frontend.md` - mixing React, Vue, Angular

### 2. Use Frontmatter Consistently
```yaml
---
tags: #category #subcategory
status: active | completed | paused
priority: high | medium | low
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

### 3. Tags Strategy
- Use hierarchical tags: `#work/wix`, `#project/cvboost`
- Limit to 3-5 tags per page
- Create tag pages for discovery

### 4. Atomic Notes
- Break complex topics into smaller, linkable pages
- Each page should make sense on its own
- Avoid duplication - link instead of repeating

---

## 🚀 Writing Workflow

### Step 1: CHECK EXISTING
```python
# Before creating:
if page_exists(topic):
    read_page(topic)
    if needs_update_only:
        edit_page(topic, add_new_info)
        return
create_page(topic, with_new_info)
```

### Step 2: CHOOSE FOLDER
- People → `People/`
- Projects → `Projects/`
- Skills → `Skills/`
- Work → `Work/`
- Tools → `Tools/`
- Daily → `Daily/YYYY-MM-DD.md`
- Guides → `Guides/` (for Clawdbot's own guides)

### Step 3: APPLY TEMPLATE
- Use appropriate template from `Templates/`
- Fill in placeholders with gathered info
- Add wikilinks to all related pages

### Step 4: LINK BACK
- For each wikilink `[[OtherPage]]`:
  - Ensure `OtherPage` exists
  - If not, add backlink reference

---

## 📋 Templates to Maintain

### 🧑 Person Template
```markdown
---
tags: #person
role: [Role]
location: [Location]
created: YYYY-MM-DD
---

# [Name]

## 👋 About
[Brief description]

## 💼 Work
- [[Company 1]] - [Role]
- [[Company 2]] - [Role]

## 💻 Skills
[[Skills Overview]]

## 🔗 Links
- GitHub: [username]
- LinkedIn: [profile]

## 📅 Timeline
- [[Daily/YYYY-MM-DD]] - [Event]
```

### 🚀 Project Template
```markdown
---
tags: #project
status: [active|completed|paused]
tech: [Tech1], [Tech2]
created: YYYY-MM-DD
---

# [Project Name]

## 🎯 Purpose
[What does this do?]

## 🛠️ Tech Stack
- [[Tech 1]]
- [[Tech 2]]

## 👤 Creator/Team
[[Person Name]]

## 🔗 Related
[[Related Project 1]]
[[Related Skill 1]]

## 📅 Timeline
- [Date] - [Event]
```

---

## 🔄 Maintenance Workflow

### Weekly Review
- [ ] Check for orphan pages (no links to/from)
- [ ] Update daily notes
- [ ] Consolidate duplicates
- [ ] Update tags

### When Tomer's Use Case Changes
1. **Identify change**: New job, new project, shift in interests
2. **Update affected pages**: Work, People, Projects
3. **Create new structure**: If needed (new folder, new category)
4. **Update this guide**: Add new patterns discovered
5. **Update Index.md**: Add new top-level connections

---

## 💡 Efficiency Tips

### ⚡ Speed Up Creation
1. Use templates (don't start from scratch)
2. Batch related pages together
3. Create links while writing (don't backtrack)
4. Use consistent structure (reduces thinking)

### 🎯 Quality Checks
- [ ] Does this page link to others?
- [ ] Are tags consistent?
- [ ] Is frontmatter complete?
- [ ] Would this make sense if read alone?
- [ ] Are there backlinks I need to create?

---

## 🔌 Notion Integration Patterns

When connecting [[Notion]] content to Obsidian:

### From Notion → Obsidian
1. Read Notion page/database via API
2. Structure content with wikilinks: `[[Page]]`
3. Add frontmatter and tags
4. Write to appropriate folder in `obsidian/`

### From Obsidian → Notion
1. Use Notion API to create page in data source
2. Map wikilinks to Notion page references
3. Set properties (Status, Date, Priority)
4. Add blocks for content

### Bidirectional Sync Strategy
- Create `[[Notion]]` page in Obsidian as hub
- Link all Notion-synced pages from there
- Use `synced_to_notion: true` property in frontmatter
- Example:
```markdown
---
tags: #project
synced_to_notion: true
notion_page_id: xxx-xxx-xxx
---

# Project Name

This project is synced to [[Notion]].
```

---

## 📊 Success Metrics

### Good Obsidian Graph = Knowledge Network
- ✅ Many interlinked pages (not isolated islands)
- ✅ Clear clusters (People cluster, Projects cluster)
- ✅ Bidirectional links (not just one-way)
- ✅ Tag-based categorization working

### Signs to Improve
- ⚠️ Orphan pages (no links)
- ⚠️ Duplicate information
- ⚠️ Inconsistent tagging
- ⚠️ Missing backlinks

---

*Meta: This guide is for Clawdbot's use. Tomer can read it too for transparency!*
