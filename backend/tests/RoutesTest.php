<?php

declare(strict_types=1);

// Routes name their controller and handler as strings, so check that every one can actually be dispatched.
it('points every route at a public instance method with the expected constructor', function (string $scope, int $constructorArguments) {
    $routes = require dirname(__DIR__) . "/routes/{$scope}.php";
    expect($routes)->not->toBeEmpty();
    foreach ($routes as $action => [$method, $controller, $handler]) {
        expect($method)->toBeIn(['GET', 'POST'], $action)
            ->and(class_exists($controller))->toBeTrue($action)
            ->and(method_exists($controller, $handler))->toBeTrue("{$action} -> {$handler}");
        $reflection = new ReflectionMethod($controller, $handler);
        expect($reflection->isPublic() && !$reflection->isStatic())->toBeTrue($action)
            ->and($reflection->getNumberOfRequiredParameters())->toBe(0, $action)
            ->and((new ReflectionClass($controller))->getConstructor()?->getNumberOfParameters())->toBe($constructorArguments, $action);
    }
})->with([['admin', 2], ['customer', 1]]);
