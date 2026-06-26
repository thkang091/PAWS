import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTextInput } from "@/components/ui/AppTextInput";
import { SelectChip } from "@/components/ui/SelectChip";
import { genderOptions } from "@/constants/onboardingOptions";
import { theme } from "@/constants/theme";
import type { OnboardingFormValues } from "@/validation/onboardingSchemas";

type Props = {
  values: OnboardingFormValues;
  setValues: (values: OnboardingFormValues) => void;
};

const dogBreeds = [
  "Mixed breed",
  "Labrador Retriever",
  "Golden Retriever",
  "German Shepherd",
  "French Bulldog",
  "Bulldog",
  "Poodle",
  "Toy Poodle",
  "Miniature Poodle",
  "Beagle",
  "Rottweiler",
  "Dachshund",
  "Yorkshire Terrier",
  "Boxer",
  "Siberian Husky",
  "Shih Tzu",
  "Border Collie",
  "Australian Shepherd",
  "Cavalier King Charles Spaniel",
  "Great Dane",
  "Doberman Pinscher",
  "Miniature Schnauzer",
  "Cocker Spaniel",
  "Boston Terrier",
  "Pomeranian",
  "Havanese",
  "Maltese",
  "Chihuahua",
  "Pug",
  "Samoyed",
  "Akita",
  "Shiba Inu",
  "Jindo",
  "Corgi",
  "Pembroke Welsh Corgi",
  "Cardigan Welsh Corgi",
  "Collie",
  "Bichon Frise",
  "Australian Cattle Dog",
  "Bernese Mountain Dog",
  "Cane Corso",
  "Papillon",
  "Whippet",
  "Greyhound",
  "Pit Bull Terrier",
  "American Staffordshire Terrier",
  "Cockapoo",
  "Goldendoodle",
  "Labradoodle",
];

export const BasicDogInfoStep = ({ values, setValues }: Props) => {
  const [isBreedFocused, setIsBreedFocused] = useState(false);

  const breedSuggestions = useMemo(() => {
    const query = values.breed.trim().toLowerCase();

    if (query.length < 1) {
      return [];
    }

    return dogBreeds
      .filter((breed) => breed.toLowerCase().includes(query))
      .slice(0, 6);
  }, [values.breed]);

  const showBreedSuggestions = isBreedFocused && breedSuggestions.length > 0;

  const handleSelectBreed = (breed: string) => {
    setValues({ ...values, breed });
    setIsBreedFocused(false);
  };

  return (
    <View style={styles.stack}>
      <AppTextInput
        label="Dog name"
        value={values.name}
        onChangeText={(name) => setValues({ ...values, name })}
        placeholder="Miso"
      />

      <View style={styles.breedWrapper}>
        <Text style={styles.label}>Breed</Text>

        <TextInput
          value={values.breed}
          onChangeText={(breed) => setValues({ ...values, breed })}
          onFocus={() => setIsBreedFocused(true)}
          placeholder="Corgi mix"
          placeholderTextColor={theme.colors.textSubtle}
          autoCapitalize="words"
          autoCorrect={false}
          style={[
            styles.input,
            showBreedSuggestions && styles.inputWithDropdown,
          ]}
        />

        {showBreedSuggestions ? (
          <View style={styles.dropdown}>
            {breedSuggestions.map((breed) => (
              <Pressable
                key={breed}
                style={({ pressed }) => [
                  styles.dropdownItem,
                  pressed && styles.dropdownItemPressed,
                ]}
                onPress={() => handleSelectBreed(breed)}
              >
                <Text style={styles.dropdownText}>{breed}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.chips}>
        {genderOptions.map((option) => (
          <SelectChip
            key={option.value}
            label={option.label}
            selected={values.gender === option.value}
            onPress={() => setValues({ ...values, gender: option.value })}
          />
        ))}
      </View>

      <AppTextInput
        label="Birthday (YYYY-MM-DD)"
        value={values.birthday ?? ""}
        onChangeText={(birthday) =>
          setValues({ ...values, birthday: birthday || null })
        }
        placeholder="2022-04-20"
      />

      <AppTextInput
        label="Approximate age in years"
        value={values.ageYears?.toString() ?? ""}
        onChangeText={(age) =>
          setValues({ ...values, ageYears: age ? Number(age) : null })
        }
        keyboardType="numeric"
        placeholder="2"
      />

      <AppTextInput
        label="Owned since (YYYY-MM-DD)"
        value={values.ownedSince ?? ""}
        onChangeText={(ownedSince) =>
          setValues({ ...values, ownedSince: ownedSince || null })
        }
        placeholder="2024-01-01"
      />

      <AppTextInput
        label="Adoption date (YYYY-MM-DD)"
        value={values.adoptionDate ?? ""}
        onChangeText={(adoptionDate) =>
          setValues({ ...values, adoptionDate: adoptionDate || null })
        }
        placeholder="Optional"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  breedWrapper: {
    position: "relative",
    zIndex: 100,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  input: {
    minHeight: 52,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: theme.typography.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.white,
  },
  inputWithDropdown: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: theme.colors.primary,
  },
  dropdown: {
  position: "absolute",
  top: 78,
  left: 0,
  right: 0,
  zIndex: 999,

  borderWidth: 1,
  borderTopWidth: 0,
  borderColor: theme.colors.primary,
  borderBottomLeftRadius: theme.radii.md,
  borderBottomRightRadius: theme.radii.md,
  backgroundColor: theme.colors.white,
  overflow: "hidden",

  elevation: 8,
  shadowColor: "#000",
  shadowOpacity: 0.12,
  shadowRadius: 12,
  shadowOffset: {
    width: 0,
    height: 6,
  },
},
  dropdownItem: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  dropdownItemPressed: {
    backgroundColor: theme.colors.primarySoft,
  },
  dropdownText: {
    color: theme.colors.text,
    fontSize: theme.typography.md,
    fontWeight: "600",
  },
});