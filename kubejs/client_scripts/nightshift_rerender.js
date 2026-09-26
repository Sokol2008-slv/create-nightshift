// Create: Ночная смена — перерисовка мира по сигналу сервера.
// Сервер шлёт nightshift_rerender после открытия фазы: руды, которые AStages прятал
// под камень, должны сразу стать видны (иначе — только после перезахода / F3+A).
NetworkEvents.dataReceived('nightshift_rerender', event => {
    Client.levelRenderer.allChanged()
})
