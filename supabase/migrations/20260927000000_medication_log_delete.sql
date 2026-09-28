create policy dog_medication_logs_delete_own on public.dog_medication_logs for delete using (owns_dog(dog_id));
