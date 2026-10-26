using System.Text.Json;
using System.Text.Json.Nodes;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Features.VolunteerNeeds;

public sealed record NeedChoiceDto(Guid Id, string Label);

public sealed record NeedQuestionDto(Guid Id, string Prompt, string Kind, NeedChoiceDto[] Choices, Guid[] CorrectChoiceIds);

public sealed record NeedFormDto(int Version, NeedQuestionDto[] Items);

public sealed record PublicQuestionDto(Guid Id, string Prompt, string Kind, NeedChoiceDto[] Choices);

public sealed record StoredAnswerDto(Guid QuestionId, string Prompt, Guid[] ChoiceIds, string[] Labels);

static class NeedForms
{
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static string Canonical(JsonNode? node)
    {
        var form = ReadNode(node);
        return JsonSerializer.Serialize(form, Json);
    }

    public static NeedFormDto Read(string json)
    {
        if (JsonNode.Parse(json) is not JsonNode node)
        {
            throw new InvalidOperationException("Need questions are missing.");
        }

        return ReadNode(node);
    }

    public static PublicQuestionDto[] PublicQuestions(string json) =>
        Read(json).Items.Select(item => new PublicQuestionDto(item.Id, item.Prompt, item.Kind, item.Choices)).ToArray();

    public static (bool Passed, string Answers) Grade(string questionsJson, JsonNode? answersNode)
    {
        var form = Read(questionsJson);
        if (answersNode is null)
        {
            if (form.Items.Length > 0)
            {
                throw ApiException.Validation("Answer every question.");
            }

            return (true, VolunteerSignupAnswers());
        }

        if (answersNode is not JsonArray answers)
        {
            throw ApiException.Validation("answers must be an array.");
        }

        if (form.Items.Length == 0)
        {
            if (answers.Count > 0)
            {
                throw ApiException.Validation("This need has no questions.");
            }

            return (true, VolunteerSignupAnswers());
        }

        var submitted = new Dictionary<Guid, Guid[]>();
        foreach (var item in answers)
        {
            if (item is not JsonObject answer)
            {
                throw ApiException.Validation("answers must be an array.");
            }

            var questionId = Fields.RequiredGuid(answer, "questionId");
            if (!submitted.TryAdd(questionId, ChoiceIds(answer)))
            {
                throw ApiException.Validation("Answer every question once.");
            }
        }

        if (submitted.Count != form.Items.Length || form.Items.Any(item => !submitted.ContainsKey(item.Id)))
        {
            throw ApiException.Validation("Answer every question.");
        }

        var passed = true;
        var stored = new List<StoredAnswerDto>();
        foreach (var question in form.Items)
        {
            var selected = submitted[question.Id];
            var known = question.Choices.Select(choice => choice.Id).ToHashSet();
            if (selected.Length != selected.Distinct().Count() || selected.Any(id => !known.Contains(id)))
            {
                throw ApiException.Validation("Choose an answer for every question.");
            }

            if (question.Kind == "single" && selected.Length != 1)
            {
                throw ApiException.Validation("Choose one answer for every question.");
            }

            if (question.Kind == "multi" && selected.Length == 0)
            {
                throw ApiException.Validation("Answer every question.");
            }

            var correct = question.CorrectChoiceIds.ToHashSet();
            if (!correct.SetEquals(selected))
            {
                passed = false;
            }

            var labels = question.Choices.Where(choice => selected.Contains(choice.Id)).Select(choice => choice.Label).ToArray();
            stored.Add(new StoredAnswerDto(question.Id, question.Prompt, selected, labels));
        }

        return (passed, JsonSerializer.Serialize(stored, Json));
    }

    public static StoredAnswerDto[] Answers(string json) =>
        JsonSerializer.Deserialize<StoredAnswerDto[]>(json, Json) ?? [];

    static string VolunteerSignupAnswers() => "[]";

    static Guid[] ChoiceIds(JsonObject answer)
    {
        if (answer["choiceIds"] is not JsonArray array)
        {
            throw ApiException.Validation("choiceIds must be an array of ids.");
        }

        return array.Select(item =>
        {
            if (item is not JsonValue value || !value.TryGetValue<string>(out var text) || !Guid.TryParse(text, out var id))
            {
                throw ApiException.Validation("choiceIds must be an array of ids.");
            }

            return id;
        }).ToArray();
    }

    static NeedFormDto ReadNode(JsonNode node)
    {
        if (node is not JsonObject body)
        {
            throw ApiException.Validation("questions must be an object.");
        }

        if (Fields.RequiredInt(body, "version") != 1)
        {
            throw ApiException.Validation("questions.version must be 1.");
        }

        if (body["items"] is not JsonArray items)
        {
            throw ApiException.Validation("questions.items must be an array.");
        }

        if (items.Count > 30)
        {
            throw ApiException.Validation("A need can have at most 30 questions.");
        }

        var questions = new List<NeedQuestionDto>();
        var seen = new HashSet<Guid>();
        foreach (var item in items)
        {
            if (item is not JsonObject question)
            {
                throw ApiException.Validation("questions.items must be an array of questions.");
            }

            var id = Fields.RequiredGuid(question, "id");
            if (!seen.Add(id))
            {
                throw ApiException.Validation("Each question needs its own id.");
            }

            var prompt = Fields.RequiredString(question, "prompt").Trim();
            if (prompt.Length is < 1 or > 300)
            {
                throw ApiException.Validation("prompt must be 1 to 300 characters.");
            }

            var kind = Fields.RequiredString(question, "kind");
            if (kind is not ("single" or "multi"))
            {
                throw ApiException.Validation("kind must be single or multi.");
            }

            if (question["choices"] is not JsonArray choices || choices.Count is < 2 or > 12)
            {
                throw ApiException.Validation("Each question needs 2 to 12 choices.");
            }

            var parsedChoices = new List<NeedChoiceDto>();
            var choiceIds = new HashSet<Guid>();
            foreach (var choiceNode in choices)
            {
                if (choiceNode is not JsonObject choice)
                {
                    throw ApiException.Validation("choices must be an array of choices.");
                }

                var choiceId = Fields.RequiredGuid(choice, "id");
                if (!choiceIds.Add(choiceId))
                {
                    throw ApiException.Validation("Each choice needs its own id.");
                }

                var label = Fields.RequiredString(choice, "label").Trim();
                if (label.Length is < 1 or > 200)
                {
                    throw ApiException.Validation("label must be 1 to 200 characters.");
                }

                parsedChoices.Add(new NeedChoiceDto(choiceId, label));
            }

            if (question["correctChoiceIds"] is not JsonArray correctNode)
            {
                throw ApiException.Validation("correctChoiceIds must be an array of ids.");
            }

            var correct = correctNode.Select(entry =>
            {
                if (entry is not JsonValue value || !value.TryGetValue<string>(out var text) || !Guid.TryParse(text, out var correctId))
                {
                    throw ApiException.Validation("correctChoiceIds must be an array of ids.");
                }

                return correctId;
            }).ToArray();
            if (correct.Length != correct.Distinct().Count() || correct.Any(correctId => !choiceIds.Contains(correctId)))
            {
                throw ApiException.Validation("The required answer must be one of the choices.");
            }

            if (kind == "single" && correct.Length != 1)
            {
                throw ApiException.Validation("A single-choice question needs one required answer.");
            }

            if (kind == "multi" && correct.Length == 0)
            {
                throw ApiException.Validation("A multiple-choice question needs a required answer.");
            }

            questions.Add(new NeedQuestionDto(id, prompt, kind, parsedChoices.ToArray(), correct));
        }

        return new NeedFormDto(1, questions.ToArray());
    }
}
