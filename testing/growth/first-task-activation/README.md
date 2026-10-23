# First-task activation experiment

## Opportunity and choice

The English and Chinese READMEs at base `f55595bab275e4f240ca01d1257ea59c22d0f73b` end Quick Start with
“send your agent a message.” Neither gives a concrete first work sample or a way to inspect completion.
This is an observed content gap, not evidence of measured abandonment.

The selected change adds a copyable, bounded local-file task and an inspection step in both languages. It uses the
existing local Runtime and messaging setup; no new integration is needed. A website redesign would require a wider
surface, while outreach or a live acquisition campaign needs separate authorization. This small README experiment
can be reviewed now.

## Hypothesis and intended measurement

For readers who have already connected their computer and messaging app, specifying an input, an output, and a check
may increase the proportion who finish a first useful task.

If an authorized user study becomes available, compare the existing “start chatting” instructions with the added
recipe using the same small project and equivalent setup. Count completion only when the participant opens the
created note and correctly checks its overview and setup steps against the README. Record blocked paths, misunderstood
instructions, and whether the participant can request a useful revision. A message receipt or an agent's success
claim alone does not count. Keep setup failures separate from the recipe's comprehensibility.

No cohort was recruited, analytics added, or growth effect measured in this change. Do not infer an uplift from the
single execution below. Keep the recipe if user evidence shows useful completed artifacts; revise it if path selection
or the output is confusing, and remove it if it distracts from the first task without helping completion.

## Actual execution and acceptance

The current gan Agent Session read the checkout's real English README and wrote `FIRST_TASK.md` at the project root.
It then checked the note's claims against **About**, **Quick Start**, and **Self-hosting and local development**.
The output was moved into this evidence directory after inspection, leaving no trial file at the repository root.

- [Actual output](FIRST_TASK.md): overview, documented setup steps, and three unanswered questions.
- [Observations and content hashes](observations.json): source and output identities, method, and limitations.
- The note preserves the supported Runtimes and Pi version. It uses the application's displayed connection command
  instead of inventing one, and labels questions as gaps in this README rather than unsupported product claims.
- The Chinese recipe was checked against the English meaning, including the full-path prerequisite, output name,
  missing-information instruction, and limits on the requested task. It was not independently executed.

This demonstrates that the task is actionable for the current Agent. It does not establish independent instruction
following, new-user success, fresh IM delivery, or a provider comparison. The change is documentation only; repository
checks apply, while application builds and UI regression suites are outside its validation scope.
