<?php

declare(strict_types=1);

namespace Vlt\Storage;

/** Levée quand la version envoyée par le client ne correspond plus à celle du Sheet. */
final class ConflictException extends \RuntimeException
{
    public function __construct(public readonly array $current, public readonly int $expectedVersion)
    {
        parent::__construct('La ressource a été modifiée par quelqu\'un d\'autre.');
    }
}
