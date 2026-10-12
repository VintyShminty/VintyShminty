import { type Control, Controller, type FieldValues, type Path } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
import { Input, type InputProps } from "@/components/ui/input";

type FormInputProps<T extends FieldValues> = Omit<InputProps, "value" | "onChangeText" | "error"> & {
  control: Control<T>;
  name: Path<T>;
  /** A message that comes from the server, shown when the form itself has no complaint. */
  serverError?: string;
  /** Shows "12/500" under the field, using maxLength. */
  showCount?: boolean;
  inputRef?: React.Ref<TextInput>;
};

/**
 * An Input wired to react-hook-form. Error messages from the shared zod schemas are translation keys,
 * so they are translated here, in the language the app is in.
 */
function FormInput<T extends FieldValues>({
  control,
  name,
  serverError,
  showCount,
  inputRef,
  onBlur,
  ...props
}: FormInputProps<T>) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          {...props}
          footerEnd={showCount ? `${String(field.value ?? "").length}/${props.maxLength}` : props.footerEnd}
          ref={inputRef}
          value={(field.value ?? "") as string}
          onChangeText={field.onChange}
          onBlur={(e) => {
            field.onBlur();
            onBlur?.(e);
          }}
          error={fieldState.error?.message ? t(fieldState.error.message) : serverError}
        />
      )}
    />
  );
}

export { FormInput };
