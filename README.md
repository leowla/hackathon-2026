# HabitRabbit

HabitRabbit is a companion pet designed to help you break your bad habits.

<img width="3024" height="1646" alt="image" src="https://github.com/user-attachments/assets/2e1156f6-d173-45f5-9e9a-faa477325ce8" />

Interact using natural language and AI will track your computer screen, compare your actions against your intended habits, and heal/damage your pet depending on your recent actions. An Arduino-based architecture allows HabitRabbit to be implemented into any soft toy.

HabitRabbit was created in 24 hours at the [WDCC x SESA Hackathon 2026](https://wdccxsesahackathon.com/).

A full presentation is available in [`/slidev`](./slidev).

## How it works

1. You tell HabitRabbit the habit you're trying to build or break (natural language)
2. AI takes screenshots on every interaction (click, scroll, keypress) to monitor your screen activity
3. An LLM classifies your activity against your stated habit goal
4. The result is sent to the Arduino over serial, which drives an LCD screen and sound to animate the pet's health and mood

## Tech stack

- **AI/LLM:** OpenAI GPT-4o
- **Screen tracking:** Screenpipe
- **Hardware:** Arduino
- **Comms:** Serial between Node.js and Arduino
- **Frontend:** Vite

## Team

Built by University of Auckland students in 24 hours at the [WDCC x SESA Hackathon 2026](https://wdccxsesahackathon.com/).

- Ava — [@AVA030215](https://github.com/AVA030215)
- Long Nguyen — [@nlong3242](https://github.com/nlong3242)
- Priyank — [@Priyankv18](https://github.com/Priyankv18)
- Kim Ngor — [@K1mmyn](https://github.com/K1mmyn)
- Hartej Bassan — [@harbassan](https://github.com/harbassan)
- Leo Wang — [@leowla](https://github.com/leowla)
