# VenU Figma screens

File: https://www.figma.com/design/WsE4dtVcbpIWfDokV0sYhc/VenU (fileKey `WsE4dtVcbpIWfDokV0sYhc`)
Snapshot: 2026-11-11. `<section>/section.png` is a 2x render of the whole section; frames are 440x956.

## Onboarding (section 179:17356)
| Screen | Node |
|---|---|
| Landing (VenU, Create Account / Sign In, social) | 184:18502 |
| Create Account | 179:17357 |
| Sign In | 181:18452 |
| Set up your profile | 184:18561 |

## Venue (section 107:1865)
| Screen | Node |
|---|---|
| Choose Your Venue (stadium cards) | 77:13 |
| Stadium facilities (sheet mid) | 131:12137 |
| Stadium facilities pulled down | 94:1493 |
| Stadium facilities pulled up | 133:12305 |
| Stadium facility popup | 133:12901 |
| Stadium facility popup lowered | 195:22973 |
| Facility report (read) | 264:27198 |
| Facility report (write form) | 276:27844 |
| "Report Submitted" notification | 276:28618 |

## Volunteer (section 134:15512)
| Screen | Node |
|---|---|
| Volunteer Home (Find a Volunteer) | 192:22809 |
| Volunteer found | 214:25058 |
| Chatroom, keyboard down | 231:25476 |
| Chatroom, keyboard up | 231:26460 |
| Volunteer feedback report (stars + chips) | 235:26589 |

## Components (section 107:1866)
Tab Bar 266:27343 (Active=Volunteer/Venue/Profile), XR Navigation bar 94:1187, Stadium Card 151:16024,
Facility Search 128:3578, Report 134:15181, Icons 131:3653, Button group 134:15133,
Header Auth 169:17275, Status bar 231:25873. Onboarding components: msft_TextInput 181:18333/18338/18344/18349,
buttons 181:18409 / 184:18521, Filter chip 192:22671, language menu 192:22041. Volunteer: Volunteer Cards 152:16995,
chat-bubble 231:25791, star rating 255:26852, Message 1 235:26730.

## Update 2026-11-15 (file lastModified 2026-11-15T23:02Z), renders in update-2026-11-15/
| Screen | Node | File |
|---|---|---|
| User flow (whole app, visitor + volunteer) | 1:30 (page "Storyboard + User Flow") | user-flow.png |
| Role choice: "I am a visitor / I am a volunteer" | 427:29849 | onboarding-screen-2.png |
| Volunteer home: "Hi, Jayden", status Free/Busy/Off, "What you can help with" | 444:31461 | onb-volunteer-home.png |
| Find a Volunteer, revised (cream background, "Or hold to speak") | 381:28816, 444:31177, 444:31302, 396:29092 | vol-home-a..d.png |
| Dialog "Need emergency help?": Call 911 / Call venue staff / not an emergency | 381:29053 | notif-d.png |
| Dialog "Cancel request? Jayden is 2 minutes away" | 381:28738 | notif-c.png |
| Toast "Thank you for your feedback!" | 396:29127 | notif-b.png |
The user flow also names screens with no frames yet: Select Match, Volunteer Not Found (Continue searching / Call venue phone), volunteer Help Request Alert (accept / can't accept), Helping visitor, Wrap-up, volunteer Profile + stats (rating, weekly helps).

## Update 2026-11-16 (file lastModified 2026-11-16T02:03Z), renders in update-2026-11-16/ (named by node id)
New section "Onboarding 2.0" (473:31894, overview render 473-31894.png): a redesigned onboarding, step by step.
| Screen | Node |
|---|---|
| Role choice first: "I am a visitor / I am a volunteer", Continue | 473:31895 |
| Landing: Create Account / Sign In, "OR sign up using" social | 482:31962 |
| Create Account: Name, Email, Username, Password, Agree with Terms & Conditions | 482:32140 |
| Sign In: Username, Password, Forgot Password? | 482:32247 |
| Choose your languages: primary + secondary (optional), Add another language | 482:32493 |
| Choose your languages with a tertiary (optional) row | 492:5984 |
| Volunteer preferences: I'd prefer help from (gender, age), Anything we should know? (needs chips), Finish Setup | 492:6216 |
| Choose a profile picture | 482:32439 |
| Set up your profile, all-in-one alternative (languages, needs, preferences), Save and continue | 482:32320 |
Also: Logo 482:31930, Flags 492:3440 (country flag set for the language search list), button variant "I am a venue visitor" 473:31613.

Volunteer section: Find a Volunteer revised again, 492:8829: location card, the help-type grid inside a tinted card,
"Add a note (optional)", Add picture / Or hold to speak buttons under the note, Send Request, red "Emergency? Call 911 now" card.
Ignored: "Section 1" 463:31577 is a mood board of other apps; 473:31590 is an empty frame.

## Update 2026-11-18 (file lastModified 2026-11-18T10:45Z), renders in update-2026-11-18/ (named by node id)
| Screen | Node |
|---|---|
| Find a Volunteer v3: location card, help types as a single-choice list (radio, icon, label: Physical Assistance, Directions, Find a facility, Translation, Something else), "Add a note (optional)" field with camera + mic icons, Send Request, Emergency card, new tab bar (heart logo on Volunteer tab) | 506:9816, 506:9697 |
| Find a Volunteer v3, note open: text box, "Add picture" and "Or hold to speak" buttons under it | 506:9412 |
| "Add a note (optional)" field, default and pressed | 506:9530 (component set "Volunteer Cards") |
| Volunteer preferences (visitor setup): Gender No preference/Male/Female, Age Any age/20-30/30-40/40+, needs chips with Other + "Describe here", Finish Setup; frosted cards on the blue gradient | 506:10114 |
| Role choice with the new heart logo, "VenU", I am a visitor / or / I am a volunteer, Continue, blue gradient background | 530:10212 |
| Storyboard (Rosa's story, 10 panels: venue map, reports, stuck at ramp, request, matched with Daniel, rate) | 61:9 |
Also new: "Logo • drawn-stroke reveal" 541:3687 (logo animation), iPhone mockup 536:4009 (mockups page). No new volunteer-side (helper) screens yet.
