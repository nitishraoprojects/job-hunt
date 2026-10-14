"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { answerQuestions } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

export function QuestionsForm({ questions }: { questions: string[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [pending, start] = useTransition()
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { await answerQuestions(answers); toast.success("Saved. Blocked jobs re-queued."); setAnswers({}) }) }}>
      <FieldGroup>
        {questions.map((q) => (
          <Field key={q}>
            <FieldLabel className="first-letter:uppercase">{q}</FieldLabel>
            <Textarea rows={2} value={answers[q] ?? ""} onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })} />
          </Field>
        ))}
        <Button type="submit" disabled={pending} className="w-fit">Save answers</Button>
      </FieldGroup>
    </form>
  )
}
