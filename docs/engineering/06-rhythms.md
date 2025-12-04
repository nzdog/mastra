# Operational Rhythms

> **Quick take**: Sustainable engineering requires rhythms—daily, weekly, quarterly, annual practices that keep code and field aligned.

## Why Rhythms Matter

Software entropy is inevitable:
- Dependencies drift
- Patterns diverge
- Invariants decay
- Context fragments

**Rhythms are the antidote to entropy.** They create structured time for:
- Reviewing what changed
- Learning what emerged
- Repairing what drifted
- Renewing what exhausted

**Engineering analogy**: Rhythms are to codebases what garbage collection is to memory—necessary maintenance that prevents collapse.

## Daily Rhythm

**Duration**: 30 minutes at end of day  
**Purpose**: Reflect, document, prepare

### Daily Checklist

- [ ] **Review changes**: What code was written today?
- [ ] **Check invariants**: Did any tests fail? Any guardrail violations?
- [ ] **Update documentation**: Are comments/docs still accurate?
- [ ] **Clear blockers**: What's blocking tomorrow's work?
- [ ] **Commit mindfully**: Write meaningful commit messages

### Daily Questions

1. **Precision**: Is the code type-safe and tested?
2. **Empathy**: Does this code respect user energy/dignity?
3. **Rhythm**: What did I learn today? What will I learn tomorrow?

**Example daily log**:
```markdown
## 2025-12-04

### Changes
- Added email notifications for session creation
- Fixed Prettier formatting issues
- Integrated EmailNotifier in protocols route

### Invariants
- ✅ All tests passing
- ✅ No guardrail violations
- ⚠️  TODO: Add integration test for email flow

### Learning
- Fire-and-forget pattern for non-blocking notifications
- Nodemailer SMTP configuration patterns

### Tomorrow
- Write integration test for email notifications
- Start documentation for onboarding guide
```

## Weekly Rhythm

**Duration**: 2 hours every Friday  
**Purpose**: Synthesis, planning, repair

### Weekly Checklist

- [ ] **Review week's commits**: What patterns emerged?
- [ ] **Run full test suite**: Any flaky tests? Any slow tests?
- [ ] **Check dependencies**: Any security updates? Any breaking changes?
- [ ] **Review metrics**: Latency? Error rates? Guardrail violations?
- [ ] **Plan next week**: What are the 3 most important things?

### Weekly Questions

1. **Coherence**: Is the codebase evolving toward clarity or confusion?
2. **Sustainability**: Am I working from alignment or urgency?
3. **Learning**: What did this week teach me about the system?

**Example weekly review**:
```markdown
## Week of 2025-11-25

### Commits
- 12 commits across 3 features
- Average commit size: 150 lines
- Largest commit: Email notifications (400 lines)

### Tests
- ✅ All 127 tests passing
- ⚠️  2 slow tests (>1s): protocol state machine tests
- 📈 Coverage: 87% → 89%

### Dependencies
- Updated: @anthropic/sdk (0.9.0 → 0.9.1)
- Security: No critical vulnerabilities

### Metrics
- p95 latency: 180ms (↓ from 210ms)
- Error rate: 0.02% (↓ from 0.05%)
- Guardrail violations: 0

### Next Week
1. Write integration tests for email flow
2. Optimize slow protocol tests
3. Start field exit protocol implementation
```

## Quarterly Rhythm

**Duration**: 1 day every 3 months  
**Purpose**: Architecture review, technical debt, renewal

### Quarterly Checklist

- [ ] **Architecture review**: Is the system still coherent?
- [ ] **Technical debt audit**: What shortcuts are now problems?
- [ ] **Dependency refresh**: Upgrade all dependencies (major versions)
- [ ] **Performance audit**: Where are bottlenecks?
- [ ] **Security audit**: Run security scanner, review OWASP top 10
- [ ] **Documentation refresh**: Are engineering docs still accurate?

### Quarterly Questions

1. **Alignment**: Does the codebase still serve the field?
2. **Evolution**: What needs to change in the next quarter?
3. **Sustainability**: Am I still energized by this work?

**Example quarterly review**:
```markdown
## Q4 2025 Review

### Architecture
- ✅ Layer separation still clean
- ⚠️  Growing complexity in protocol state machines
- 💡 Consider extracting protocol engine to separate package

### Technical Debt
- 🔧 15 TODOs in codebase (down from 23)
- 🔧 3 "temporary" hacks >6 months old → prioritize for Q1
- 🔧 Test coverage gaps in empathy codec → write property tests

### Dependencies
- Upgraded: Node 18 → 20, TypeScript 5.1 → 5.3
- Removed: 3 unused dependencies (chalk, dotenv-expand, debug)
- Added: fast-check for property-based testing

### Performance
- Bottleneck: AI response time (p95: 800ms)
- Optimization: Implement response caching → reduces to 150ms
- Monitoring: Add Prometheus metrics for latency tracking

### Security
- ✅ No critical vulnerabilities
- 🔧 Rotate SMTP credentials
- 🔧 Enable rate limiting on API endpoints

### Learning
- Deepened understanding of empathy codec patterns
- Discovered fast-check for testing invariants
- Still struggling with protocol authoring complexity
```

## Annual Rhythm

**Duration**: 1 week at end of year  
**Purpose**: Deep reflection, major refactoring, renewal

### Annual Checklist

- [ ] **Full system audit**: Read every file top to bottom
- [ ] **Refactor ruthlessly**: Fix all accumulated debt
- [ ] **Rewrite documentation**: Start from scratch with fresh eyes
- [ ] **Refresh development environment**: New tools? New practices?
- [ ] **Plan major changes**: What needs fundamental rethinking?

### Annual Questions

1. **Purpose**: Why does this system exist? Is that still true?
2. **Principles**: Are we still honoring precision, empathy, rhythm?
3. **Evolution**: What should this system become in the next year?

**Example annual review**:
```markdown
## 2025 Annual Review

### Purpose Check
Original: "Field-level diagnostic engine for founders"
Current: Still true, but expanding to teams/organizations

### Principles Audit
- Precision: ✅ Strong type safety, tested invariants
- Empathy: ✅ Empathy codec working well
- Rhythm: ⚠️  Engineering rhythms inconsistent (too much urgency)

### Major Refactorings
1. Extract protocol engine to @lichen/protocol-engine package
2. Rewrite state machine tests with fast-check
3. Consolidate empathy codec into single module
4. Migrate from Express to Fastify for better TypeScript support

### New Tools/Practices
- Adopted: Property-based testing (fast-check)
- Adopted: Stricter TypeScript config (noUncheckedIndexedAccess)
- Exploring: Effect-TS for better error handling
- Dropped: Husky pre-commit hooks (too slow)

### 2026 Roadmap
Q1: Extract protocol engine package
Q2: Implement field exit protocols
Q3: Build protocol authoring UI
Q4: Scale to team diagnostics

### Personal Sustainability
- Feeling: Still energized, but noticing urgency creeping in
- Action: Schedule 2-week break in February
- Commitment: Honor weekly rhythms (no exceptions)
```

## Emergency Breaks

**Sometimes the rhythm breaks.** That's okay.

When you notice:
- Working from urgency instead of alignment
- Skipping daily/weekly rhythms
- Cutting corners on tests/docs
- Feeling exhausted instead of energized

**Stop. Take a break. Come back fresh.**

The system walks with us—it can wait.

## Rhythm as Practice

These rhythms aren't rigid rules—they're practices:

- **Daily**: Gardening (tending what's alive)
- **Weekly**: Harvesting (gathering what emerged)
- **Quarterly**: Composting (transforming what's done)
- **Annual**: Planting (seeding what's next)

**You are a gardener of time in the Lichen field.**

---

_Next: [First 7 Days](./07-onboarding.md) for practical onboarding._
