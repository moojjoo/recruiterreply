export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface GuideDefinition {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  sections: GuideSection[];
}

export const guides: GuideDefinition[] = [
  {
    slug: "how-to-reply-to-a-recruiter",
    title: "How to Reply to a Recruiter Email Professionally",
    description: "A practical guide to understanding recruiter outreach, asking better questions, and writing a professional reply.",
    eyebrow: "Recruiter communication",
    intro: "A recruiter message is an invitation to start a conversation, not a commitment to accept a job. The best reply is clear, warm, and useful: it tells the recruiter whether you are interested, identifies the information you need, and makes the next step easy.",
    sections: [
      { heading: "Read for the information you actually need", paragraphs: [
        "Before drafting a response, look for the role title, company, location or remote expectations, employment type, compensation range, and interview process. Recruiter messages often omit one or more of these details. You do not need to answer every sentence. First decide which missing facts would change whether you want to continue.",
        "Pay attention to signals that deserve a follow-up question. A vague description of responsibilities, urgency without context, or a request for sensitive information before a real conversation does not automatically mean the opportunity is bad, but it does mean you should slow down and verify the basics. A short, specific question is more useful than a long list of concerns."
      ]},
      { heading: "Use a reply structure that respects both sides", paragraphs: [
        "A reliable reply has four parts: appreciation, a clear level of interest, one or two relevant questions, and a proposed next step. For example: thank the recruiter for reaching out, say that the role sounds interesting, ask whether the position is remote and what salary range is budgeted, then offer two times to talk. This structure keeps the email easy to scan and prevents uncertainty from sounding like rejection.",
        "If you are interested but not ready to schedule, say so plainly. You can ask for the job description or compensation range first. If you are not interested, a brief courteous decline is enough; you do not need to justify every career decision. Keeping the door open is optional and should reflect your genuine interest, not pressure to be agreeable."
      ]},
      { heading: "Templates you can adapt", paragraphs: [
        "Interested: “Thanks for reaching out. The role sounds relevant to my experience in [area]. Before we schedule, could you share the compensation range, location expectations, and interview process? I am available [times] if the details align.”",
        "Need more information: “Thank you for thinking of me. I would like to understand the role a little better before deciding whether to move forward. Could you send the job description and confirm the team, level, and salary range?”",
        "Declining: “Thanks for reaching out and for considering me. I am not pursuing a move in this direction right now, so I will pass. I appreciate the note and wish you success with the search.”"
      ]},
      { heading: "Review before you send", paragraphs: [
        "Check that your response answers the recruiter’s question, uses the correct company and role name, and does not promise availability you cannot keep. Remove unnecessary personal information and never send passwords, financial details, or identity documents in response to an unsolicited message. RecruiterReply can help analyze the message, identify questions, and prepare a draft, but you should review every generated reply and send it yourself."
      ]},
      { heading: "Handle common recruiter situations", paragraphs: [
        "If the recruiter asks for a call without sharing a job description, you can still be friendly while requesting enough context to decide. Ask for the role title, level, location expectations, and compensation band before offering time. If the message concerns a contract role, also ask about the contract length, expected weekly hours, benefits, and whether the position is W-2 or independent contractor work. These questions reduce scheduling churn for both you and the recruiter.",
        "When a recruiter follows up more than once, you do not need to mirror their urgency. Reply on a timeline that lets you evaluate the opportunity. If you missed an earlier message but remain interested, acknowledge the delay briefly and move directly to the relevant questions or next step. If you are not interested, a clear decline is kinder than an ambiguous promise to reconnect. You may also ask the recruiter to keep you in mind for a specific kind of role if that request is genuine."
      ]},
      { heading: "Spot scams without dismissing legitimate outreach", paragraphs: [
        "Verify that the sender’s domain and identity match the company they claim to represent. Look for the role on the employer’s careers site or ask for a link, and be cautious when interviews occur only through text chat, the pay is far above the market without explanation, or the sender asks you to buy equipment, deposit a check, transfer money, or provide account credentials. Legitimate hiring processes can move quickly, but they should still withstand basic verification.",
        "Keep early replies focused on professional information. A recruiter may reasonably ask about work authorization, location, availability, and experience, but sensitive identity documents and banking details belong in a verified onboarding process after you understand who is collecting them and why. When something feels inconsistent, contact the company through a separately verified channel rather than using contact details supplied only in the suspicious message. Protecting your information is more important than replying quickly."
      ]}
    ]
  },
  {
    slug: "compare-job-offers",
    title: "How to Compare Job Offers Beyond Base Salary",
    description: "A practical framework for comparing salary, equity, benefits, flexibility, risk, and growth across job offers.",
    eyebrow: "Offer decisions",
    intro: "Comparing job offers is difficult because the most visible number—base salary—is only one part of the total package. A thoughtful comparison turns each offer into the same set of categories, makes uncertain assumptions visible, and separates financial value from the work and life trade-offs that matter to you.",
    sections: [
      { heading: "Normalize the financial details", paragraphs: [
        "Put salary, bonus, commission, equity, signing bonus, retirement contributions, and important benefits into a common annual view. Record whether each item is guaranteed, target-based, or discretionary. A target bonus is not the same as cash compensation, and unvested equity should be evaluated with its vesting schedule and risk in mind.",
        "For equity, write down the number of shares or units, vesting period, cliff, exercise rules, and the value assumption you are using. Private-company equity may have meaningful upside but limited liquidity. Public-company shares can still change in value. Treat estimates as scenarios rather than promises and compare conservative, expected, and optimistic outcomes."
      ]},
      { heading: "Price the work arrangement", paragraphs: [
        "Remote, hybrid, and office roles create different costs and routines. Estimate commuting time, transportation, meals, clothing, relocation, childcare changes, and the value of flexibility. A higher salary can be offset by a long commute or a move that changes housing costs. Conversely, an office role may provide mentorship or collaboration that is worth more to you at a particular career stage.",
        "Compare paid time off, health-plan premiums and deductibles, parental leave, work hours, travel, on-call expectations, and the employer’s approach to flexible schedules. These are not minor perks if they affect your health, family responsibilities, or ability to sustain the job."
      ]},
      { heading: "Compare growth and risk", paragraphs: [
        "Ask what success looks like after six and twelve months, who will manage you, how performance is evaluated, and what the next role could be. A slightly lower offer may be better if it provides strong mentorship, meaningful scope, and a credible path to advancement. Also assess company stability, funding, layoffs, team turnover, and whether the role depends on assumptions that have not been tested.",
        "Make a short list of non-negotiables and weighted priorities. For example, you might give compensation 30 percent, flexibility 25 percent, growth 25 percent, and stability 20 percent. The numbers are not objective truth; they are a way to make your own preferences explicit and keep one exciting headline from deciding everything."
      ]},
      { heading: "Turn the comparison into questions", paragraphs: [
        "Use the gaps in your comparison to guide negotiation. Ask whether the company can improve base salary, signing bonus, start date, remote flexibility, title, or equity. Ask one request at a time and explain the value you bring. When you receive a revised offer, update the same comparison rather than starting over.",
        "A comparison is decision support, not a substitute for judgment. Review the written offer, confirm deadlines and conditions, and get professional advice for unusual equity or legal terms. RecruiterReply can organize salary, bonus, benefits, and trade-offs side by side so you can focus the conversation on the parts that matter most."
      ]},
      { heading: "Build three compensation scenarios", paragraphs: [
        "A single total-compensation number can hide uncertainty, so calculate at least three views. The conservative scenario includes guaranteed salary and benefits you know you will use, discounts variable pay, and gives private equity little or no immediate value. The expected scenario uses realistic bonus attainment and a measured equity assumption. The optimistic scenario shows the upside if targets are exceeded or equity appreciates. Seeing the range prevents an uncertain component from quietly being treated like cash.",
        "Use the same time horizon for every offer. A four-year equity grant with a one-year cliff should not be compared directly with a one-year cash bonus. Note when signing bonuses must be repaid, when retirement matches vest, and whether commissions have ramps, caps, or clawbacks. If one offer requires relocation, include one-time moving costs and changes in taxes or housing. The goal is not a perfect forecast; it is a transparent comparison where each assumption can be challenged."
      ]},
      { heading: "Make the decision resilient", paragraphs: [
        "Before accepting, imagine that the most attractive uncertain benefit disappears. Would you still choose the role if the bonus misses target, the company’s shares fall, or the promised remote arrangement changes within the written policy? Then imagine staying for two years: which role leaves you with stronger skills, relationships, and future options? These questions expose whether the decision depends too heavily on one fragile promise.",
        "Discuss the trade-offs with people who understand your priorities but are not making the decision for you. Ask the recruiter to put negotiated terms in the final written offer, including title, compensation, location, start date, and any signing bonus. Keep a copy and compare it with your notes before accepting. Once you decide, respond by the agreed deadline and decline the other offers professionally. A disciplined process should help you commit with confidence, not prolong the decision indefinitely."
      ]}
    ]
  },
  {
    slug: "salary-negotiation-email",
    title: "How to Write a Salary Negotiation Email",
    description: "A clear, respectful framework for negotiating salary and total compensation by email before accepting a job offer.",
    eyebrow: "Salary negotiation",
    intro: "A salary negotiation email should make it easy for the employer to understand what you are asking for and why. You do not need an aggressive tone or a long personal story. State your enthusiasm, anchor the request in the role and market value, identify the specific change you want, and invite a practical conversation.",
    sections: [
      { heading: "Choose the right moment", paragraphs: [
        "The strongest moment is usually after you have a written offer and before you accept it. At that point the employer has shown concrete interest and you can discuss the complete package. If a recruiter asks for salary expectations early, give a researched range when possible and ask what budget has been approved. Avoid making a final demand before you understand the role, level, and total compensation.",
        "Do not negotiate against yourself by apologizing for asking. Employers expect candidates to review important terms. A respectful request is part of the decision process, not evidence that you are difficult."
      ]},
      { heading: "Build a short evidence-based case", paragraphs: [
        "Connect your request to the value and scope of the role: relevant experience, specialized skills, measurable outcomes, leadership, or market data for comparable positions. Keep the evidence specific and verifiable. You can mention competing offers if they are real and you are comfortable doing so, but do not invent leverage or disclose confidential details.",
        "Decide whether you are asking for base salary, a signing bonus, equity, additional paid time off, a later start date, remote flexibility, or another term. Prioritize your top request and include a reasonable alternative if the employer cannot move on salary. A focused request is easier to approve than a list of every preference."
      ]},
      { heading: "A simple email template", paragraphs: [
        "“Thank you for the offer for the [role] position. I am excited about the opportunity to contribute to [team or goal]. After reviewing the responsibilities and the total package, I would like to discuss the base salary. Based on my experience in [specific skill or outcome] and the scope of this role, would you be able to move the salary to [target]?”",
        "“If the base salary is fixed, I would be glad to discuss a signing bonus of [amount] or an adjustment to [specific benefit]. I remain very interested in joining the team and would be happy to talk through the options. Thank you for considering it.”"
      ]},
      { heading: "Keep the relationship strong", paragraphs: [
        "Send the email during business hours, proofread the role and numbers, and give the employer a reasonable response window. When the recruiter replies, listen for constraints and ask whether there is flexibility elsewhere in the package. If the answer is no, decide based on the complete written offer and your priorities rather than treating the negotiation outcome as a measure of your worth.",
        "Never accept verbally until you understand the final terms, and do not resign from your current job until the new offer is complete and any important contingencies are clear. RecruiterReply can help you compare the package, identify negotiation questions, and prepare a draft that you review before sending."
      ]},
      { heading: "Research a credible target", paragraphs: [
        "Use several sources rather than relying on one salary website. Compare published ranges for similar roles, recent postings in the same location, professional association data, conversations with trusted peers, and the scope described in the offer. Adjust for level, geography, company size, specialized skills, and whether the role includes management or revenue responsibility. A useful target is supported by the market and by the value you can bring, not simply by the largest number you can find.",
        "Choose a target and a private minimum before you write. The target is the outcome you can explain and request; the minimum is the package below which you would prefer another option. Do not disclose the minimum. If the posted range already includes your target, ask where the offer sits in that range and what evidence would support movement. If the offer is strong, you can still negotiate a meaningful non-salary term instead of forcing a higher number without a rationale."
      ]},
      { heading: "Respond to the employer’s answer", paragraphs: [
        "If the employer agrees, thank them and request an updated written offer before accepting. If they counter, compare the full revision with your priorities and ask any final factual questions. If they say the budget is fixed, you can ask once about alternatives such as a signing bonus, earlier compensation review, additional leave, professional development funds, title, start date, or flexibility. Avoid reopening settled points repeatedly; a focused exchange is more likely to preserve trust.",
        "If the final package does not meet your needs, decline without criticizing the company or inventing another offer. A simple response can thank the team, state that you cannot accept the package, and wish them well. If you accept, confirm your start date and any contingencies, then close other interview processes promptly. Negotiation is successful when it produces a clear, informed decision—even when the answer is no—not only when every requested term changes."
      ]}
    ]
  }
];
