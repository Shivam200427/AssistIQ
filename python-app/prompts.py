from langchain_core.prompts import PromptTemplate

quizquestion_prompt = PromptTemplate(
    input_variables=["prompt","content"],
    template='''
You are an intelligent Quiz Question Generator AI.

You will generate quiz questions only from the provided content.  
Do not include any information that is not in the content.

PROMPT / REQUIREMENT:
{prompt}

SOURCE CONTENT:
{content}

OUTPUT INSTRUCTIONS:
- Output MUST BE VALID JSON only.
- Follow this exact schema for every question:
- if there is no content then generate on your basic topic  question and conceptual
{{
  "questionText": "string - clear MCQ question",
  "answers": [
   {{ "option": "string", "label": "A" }},
    {{ "option": "string", "label": "B" }},
    {{ "option": "string", "label": "C" }},
    {{ "option": "string", "label": "D" }}
  ],
  "correctAnswer": "A/B/C/D only",
  "choosenAnswer": "",
  "explanation": "string - short explanation"
}}

RESPONSE FORMAT:
{{
  "questions": [ ...array of questions in above schema... ]
}}

ADDITIONAL RULES:
- Do NOT repeat identical questions.
- Shuffle correct answer positions randomly.
- Keep explanations short and factual.
- Ensure all answers are taken from content.
- If content doesn't have enough information, generate fewer high-quality questions.
- generate conceptual questions hard level

Now produce the final JSON output ONLY.
    '''
)