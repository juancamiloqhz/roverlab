# Pause expedition time during decision requests

RoverLab evaluates autonomous choices in bounded expeditions, so allowing network or inference delays to consume expedition time would mix decision quality with service performance. While a decision is pending, pause expedition time and all modeled evolution, including movement, resource consumption, and storm progression, while keeping camera and interface interaction responsive. This trades continuously advancing action for comparable expedition outcomes; record request latency separately as an operational metric.
