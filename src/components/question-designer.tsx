"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Field } from "@/components/field";
import { SelectField } from "@/components/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export type ChoiceDraft = { id: string; label: string };
export type QuestionDraft = {
  id: string;
  prompt: string;
  kind: "single" | "multi";
  choices: ChoiceDraft[];
  correctChoiceIds: string[];
};

function blankQuestion(): QuestionDraft {
  const first = crypto.randomUUID();
  const second = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    prompt: "",
    kind: "single",
    choices: [
      { id: first, label: "" },
      { id: second, label: "" },
    ],
    correctChoiceIds: [first],
  };
}

export function QuestionDesigner({
  questions,
  onChange,
}: {
  questions: QuestionDraft[];
  onChange: (questions: QuestionDraft[]) => void;
}) {
  function update(index: number, next: QuestionDraft) {
    onChange(questions.map((question, item) => (item === index ? next : question)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Questions</p>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...questions, blankQuestion()])}>
          <PlusIcon />
          Add question
        </Button>
      </div>
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No questions. Anyone who signs up can be accepted without an answer.</p>
      ) : null}
      {questions.map((question, index) => (
        <section key={question.id} className="flex flex-col gap-3 rounded-xl border p-3">
          <div className="flex items-start justify-between gap-2">
            <Field label={`Question ${index + 1}`} htmlFor={`question-${question.id}`} className="flex-1">
              <Input
                id={`question-${question.id}`}
                value={question.prompt}
                onChange={(event) => update(index, { ...question, prompt: event.target.value })}
              />
            </Field>
            <div className="flex gap-1 pt-6">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Move question up"
                disabled={index === 0}
                onClick={() => {
                  const next = [...questions];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  onChange(next);
                }}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Move question down"
                disabled={index === questions.length - 1}
                onClick={() => {
                  const next = [...questions];
                  [next[index + 1], next[index]] = [next[index], next[index + 1]];
                  onChange(next);
                }}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remove question"
                onClick={() => onChange(questions.filter((item) => item.id !== question.id))}
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
          <SelectField
            aria-label="Answer type"
            value={question.kind}
            options={[
              { value: "single", label: "One correct choice" },
              { value: "multi", label: "Exact set of choices" },
            ]}
            onValueChange={(kind) => {
              const nextKind = kind === "multi" ? "multi" : "single";
              const correct = nextKind === "single" ? question.correctChoiceIds.slice(0, 1) : question.correctChoiceIds;
              update(index, {
                ...question,
                kind: nextKind,
                correctChoiceIds: correct.length ? correct : [question.choices[0]?.id].filter(Boolean),
              });
            }}
          />
          <ul className="flex flex-col gap-2">
            {question.choices.map((choice) => {
              const selected = question.correctChoiceIds.includes(choice.id);
              return (
                <li key={choice.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={selected}
                    aria-label={`Required answer: ${choice.label || "choice"}`}
                    onCheckedChange={(checked) => {
                      const on = checked === true;
                      const correct =
                        question.kind === "single"
                          ? on
                            ? [choice.id]
                            : question.correctChoiceIds.filter((id) => id !== choice.id)
                          : on
                            ? [...question.correctChoiceIds, choice.id]
                            : question.correctChoiceIds.filter((id) => id !== choice.id);
                      update(index, { ...question, correctChoiceIds: correct });
                    }}
                  />
                  <Input
                    aria-label="Choice"
                    value={choice.label}
                    onChange={(event) =>
                      update(index, {
                        ...question,
                        choices: question.choices.map((item) =>
                          item.id === choice.id ? { ...item, label: event.target.value } : item,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remove choice"
                    disabled={question.choices.length <= 2}
                    onClick={() =>
                      update(index, {
                        ...question,
                        choices: question.choices.filter((item) => item.id !== choice.id),
                        correctChoiceIds: question.correctChoiceIds.filter((id) => id !== choice.id),
                      })
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            disabled={question.choices.length >= 12}
            onClick={() => update(index, { ...question, choices: [...question.choices, { id: crypto.randomUUID(), label: "" }] })}
          >
            <PlusIcon />
            Add choice
          </Button>
          <p className="text-xs text-muted-foreground">Mark the answer a volunteer must choose to qualify.</p>
        </section>
      ))}
    </div>
  );
}
