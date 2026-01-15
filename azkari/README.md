# Azkari - أذكاري 🤲

A spirituality and mindfulness VS Code extension that displays Arabic Dhikr (remembrances) as gentle, non-intrusive reminders while you code.

## Features

- 🕌 **Sequential Dhikr Display**: Cycles through six beautiful Dhikr phrases one by one
- ⏱️ **Configurable Interval**: Set your preferred reminder interval (default: 3 minutes)
- 🎯 **Non-intrusive**: Uses VS Code's information messages for gentle reminders
- 📊 **Status Bar Integration**: Quick access to start/stop reminders
- 🚀 **Auto-start Option**: Automatically begins when VS Code opens

## Dhikr Phrases Included

1. سُبْحَانَ اللَّهِ (SubhanAllah - Glory be to Allah)
2. وَالْحَمْدُ لِلَّهِ (Alhamdulillah - Praise be to Allah)
3. وَلَا إِلَهَ إِلَّا اللَّهُ (La ilaha illallah - There is no god but Allah)
4. وَاللَّهُ أَكْبَرُ (Allahu Akbar - Allah is the Greatest)
5. وَلَا حَوْل وَلَا قُوَّة إِلَّا بِاَلله (La hawla wa la quwwata illa billah - There is no power nor strength except with Allah)
6. اللَّهُــمَّ صـَلِّ وَسَـــلِّمْ وبارك على سيدنا مُحمَّد وآله ﷺ (Salawat upon Prophet Muhammad ﷺ)

## Commands

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and type:

| Command                            | Description                    |
| ---------------------------------- | ------------------------------ |
| `Azkari: Start Dhikr Reminders`    | Start the Dhikr reminder timer |
| `Azkari: Stop Dhikr Reminders`     | Stop the Dhikr reminder timer  |
| `Azkari: Show Dhikr Now`           | Display a Dhikr immediately    |
| `Azkari: Set Dhikr Timer Interval` | Change the reminder interval   |

## Settings

Configure Azkari in your VS Code settings:

| Setting                  | Type    | Default | Description                                        |
| ------------------------ | ------- | ------- | -------------------------------------------------- |
| `azkari.intervalMinutes` | number  | 3       | Interval in minutes between Dhikr reminders (1-60) |
| `azkari.autoStart`       | boolean | true    | Automatically start reminders when VS Code opens   |

## Installation

### From VSIX File

1. Download the `.vsix` file
2. Open VS Code
3. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
4. Type "Install from VSIX" and select the command
5. Choose the downloaded `.vsix` file

---

**بارك الله فيكم** - May Allah bless you all 🤲
