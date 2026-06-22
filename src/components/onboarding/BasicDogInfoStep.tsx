import { StyleSheet, View } from "react-native";

import { AppTextInput } from "@/components/ui/AppTextInput";
import { SelectChip } from "@/components/ui/SelectChip";
import { genderOptions } from "@/constants/onboardingOptions";
import { theme } from "@/constants/theme";
import type { OnboardingFormValues } from "@/validation/onboardingSchemas";

type Props = {
  values: OnboardingFormValues;
  setValues: (values: OnboardingFormValues) => void;
};

export const BasicDogInfoStep = ({ values, setValues }: Props) => (
  <View style={styles.stack}>
    <AppTextInput label="Dog name" value={values.name} onChangeText={(name) => setValues({ ...values, name })} placeholder="Miso" />
    <AppTextInput label="Breed" value={values.breed} onChangeText={(breed) => setValues({ ...values, breed })} placeholder="Corgi mix" />
    <View style={styles.chips}>
      {genderOptions.map((option) => (
        <SelectChip key={option.value} label={option.label} selected={values.gender === option.value} onPress={() => setValues({ ...values, gender: option.value })} />
      ))}
    </View>
    <AppTextInput label="Birthday (YYYY-MM-DD)" value={values.birthday ?? ""} onChangeText={(birthday) => setValues({ ...values, birthday: birthday || null })} placeholder="2022-04-20" />
    <AppTextInput label="Approximate age in years" value={values.ageYears?.toString() ?? ""} onChangeText={(age) => setValues({ ...values, ageYears: age ? Number(age) : null })} keyboardType="numeric" placeholder="2" />
    <AppTextInput label="Owned since (YYYY-MM-DD)" value={values.ownedSince ?? ""} onChangeText={(ownedSince) => setValues({ ...values, ownedSince: ownedSince || null })} placeholder="2024-01-01" />
    <AppTextInput label="Adoption date (YYYY-MM-DD)" value={values.adoptionDate ?? ""} onChangeText={(adoptionDate) => setValues({ ...values, adoptionDate: adoptionDate || null })} placeholder="Optional" />
  </View>
);

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
});
