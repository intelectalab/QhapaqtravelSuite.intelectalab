<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_the_application_is_up(): void
    {
        $this->get('/up')->assertStatus(200);
    }
}
