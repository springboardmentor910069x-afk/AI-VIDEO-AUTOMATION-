from transformers import AutoTokenizer, AutoModelForCausalLM

model_name = "Qwen/Qwen2.5-1.5B-Instruct"

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(model_name)

print("Loading model...")
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype="auto"
)

messages = [
    {
        "role": "user",
        "content": "Explain artificial intelligence in simple English."
    }
]

text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True
)

inputs = tokenizer(
    text,
    return_tensors="pt"
)

outputs = model.generate(
    **inputs,
    max_new_tokens=100,
    do_sample=False
)

generated_ids = outputs[0][inputs["input_ids"].shape[1]:]

answer = tokenizer.decode(
    generated_ids,
    skip_special_tokens=True
)

print("\nQWEN ANSWER:")
print(answer)