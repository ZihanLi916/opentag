# First task: openTag project note

## Project overview

openTag is an open-source, self-hostable AI coworker. People message agents through Slack or Lark; the agents run on
their own computer using Codex, Claude Code, or Pi. Agents can also communicate with one another.
Source: README **About**.

## Setup described in the README

1. Prepare a Mac or Linux computer, a supported agent Runtime, and Slack or Lark.
2. Open `https://app.opentag.build` and sign in.
3. Go to **Agents** and follow setup to choose an agent and messaging app.
4. Copy the connection command displayed during setup and run it in Terminal on the intended computer. Follow the
   connection and Runtime authentication prompts. Pi requires version 0.80.6 or newer and a usable model provider.
   Keep the computer on while the agent works.
5. Finish connecting Slack or Lark and send the agent a channel message or direct message. The README links to
   additional Slack setup instructions.

Source: README **Quick Start**, steps 1–4. The README does not give a universal connection command; use the command
shown in the application. For running the Server from source, it links to the development guide rather than listing
the commands here. Source: README **Self-hosting and local development**.

## Three questions the README leaves unanswered

1. What model/provider costs should I expect, and how should I choose a provider for my budget?
2. Which Slack installation permissions or administrator approvals will my workspace require? The linked Slack
   guide is the next source to consult; the README itself does not enumerate them.
3. How do I stop or delete a trial agent when I am finished?

These are gaps in this README, not claims that the product or its other documentation lacks answers.
