<?php

it('el libro de reclamaciones responde en /crm/claim-book', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/crm/claim-book')->assertOk();
    $this->postJson('/api/v1/crm/claim-book/REC-0021/review', [], critical((int) rowOf('crm_cases', 'REC-0021')->lock_version))->assertOk();

    expect(rowOf('crm_cases', 'REC-0021')->book_status)->toBe('in_review')
        ->and($this->getJson('/api/v1/crm/claims')->status())->toBe(404)
        ->and(routeExists('POST', '/api/v1/crm/claims/REC-0021/evaluate'))->toBeFalse()
        ->and(routeExists('POST', '/api/v1/crm/claim-book/REC-0021/response'))->toBeTrue()
        ->and(routeExists('POST', '/api/v1/crm/claim-book/REC-0021/close'))->toBeTrue();
});
