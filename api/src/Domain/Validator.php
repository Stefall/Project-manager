<?php

declare(strict_types=1);

namespace Vlt\Domain;

use Vlt\Http\HttpException;

/** Accumule les erreurs champ par champ et les renvoie en une fois (HTTP 422). */
final class Validator
{
    private array $errors = [];

    public function __construct(private readonly array $data)
    {
    }

    public function has(string $field): bool
    {
        return array_key_exists($field, $this->data);
    }

    public function string(string $field, bool $required = false, int $max = 5000): self
    {
        $value = $this->data[$field] ?? null;
        if ($value === null || $value === '') {
            if ($required) {
                $this->errors[$field] = 'Champ obligatoire.';
            }
            return $this;
        }
        if (!is_string($value)) {
            $this->errors[$field] = 'Texte attendu.';
        } elseif (mb_strlen($value) > $max) {
            $this->errors[$field] = "$max caractères maximum.";
        }
        return $this;
    }

    public function date(string $field): self
    {
        $value = $this->data[$field] ?? '';
        if ($value === '' || $value === null) {
            return $this;
        }
        $d = is_string($value) ? \DateTimeImmutable::createFromFormat('!Y-m-d', $value) : false;
        if ($d === false || $d->format('Y-m-d') !== $value) {
            $this->errors[$field] = 'Date au format AAAA-MM-JJ attendue.';
        }
        return $this;
    }

    public function in(string $field, array $allowed, bool $required = false): self
    {
        if (!$this->has($field) || $this->data[$field] === '') {
            if ($required) {
                $this->errors[$field] = 'Champ obligatoire.';
            }
            return $this;
        }
        if (!in_array($this->data[$field], $allowed, true)) {
            $this->errors[$field] = 'Valeur non autorisée.';
        }
        return $this;
    }

    public function subset(string $field, array $allowed): self
    {
        $value = $this->data[$field] ?? [];
        if (!is_array($value) || array_diff($value, $allowed) !== []) {
            $this->errors[$field] = 'Valeurs non autorisées.';
        }
        return $this;
    }

    public function listOf(string $field, callable $itemIsValid, string $message): self
    {
        $value = $this->data[$field] ?? [];
        if (!is_array($value) || !array_is_list($value)) {
            $this->errors[$field] = $message;
            return $this;
        }
        foreach ($value as $item) {
            if (!$itemIsValid($item)) {
                $this->errors[$field] = $message;
                break;
            }
        }
        return $this;
    }

    public function check(bool $ok, string $field, string $message): self
    {
        if (!$ok && !isset($this->errors[$field])) {
            $this->errors[$field] = $message;
        }
        return $this;
    }

    public function validate(): void
    {
        if ($this->errors !== []) {
            throw new HttpException(422, 'Certains champs sont invalides.', ['fields' => $this->errors]);
        }
    }

    public static function isUrl(mixed $value): bool
    {
        return is_string($value) && preg_match('#^https?://#i', $value) === 1 && filter_var($value, FILTER_VALIDATE_URL) !== false;
    }
}
