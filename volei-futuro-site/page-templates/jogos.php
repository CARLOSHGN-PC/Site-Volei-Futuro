<section id="games-page">
    <h2>Jogos e Resultados</h2>
    <p>Acompanhe a jornada da nossa equipe durante a temporada.</p>

    <div class="games-section">
        <h3>Próximos Jogos</h3>
        <ul class="upcoming-games-list">
            <?php
            // Simulação de dados de próximos jogos
            $upcoming_games = [
                ['opponent' => 'Time Vizinhança', 'date' => '25 de Setembro, 2024 - 18:00', 'location' => 'Ginásio Municipal'],
                ['opponent' => 'Clube Esportivo Central', 'date' => '02 de Outubro, 2024 - 19:00', 'location' => 'Fora de casa'],
                ['opponent' => 'Associação Atlética do Bairro', 'date' => '09 de Outubro, 2024 - 18:00', 'location' => 'Ginásio Municipal']
            ];

            foreach ($upcoming_games as $game) {
                echo '<li>';
                echo '<strong>' . htmlspecialchars($game['opponent']) . '</strong>';
                echo '<span>' . htmlspecialchars($game['date']) . '</span>';
                echo '<span>' . htmlspecialchars($game['location']) . '</span>';
                echo '</li>';
            }
            ?>
        </ul>
    </div>

    <div class="games-section">
        <h3>Resultados Anteriores</h3>
        <table class="results-table">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Adversário</th>
                    <th>Placar</th>
                    <th>Resultado</th>
                </tr>
            </thead>
            <tbody>
                <?php
                // Simulação de dados de resultados
                $results = [
                    ['date' => '05/09/2024', 'opponent' => 'Time da Cidade Alta', 'score' => '3x2', 'result' => 'Vitória'],
                    ['date' => '29/08/2024', 'opponent' => 'Esporte Clube do Porto', 'score' => '1x3', 'result' => 'Derrota'],
                    ['date' => '22/08/2024', 'opponent' => 'Juventus Voleibol', 'score' => '3x0', 'result' => 'Vitória'],
                    ['date' => '15/08/2024', 'opponent' => 'União Volei', 'score' => '3x1', 'result' => 'Vitória']
                ];

                foreach ($results as $result) {
                    $result_class = $result['result'] === 'Vitória' ? 'win' : 'loss';
                    echo '<tr>';
                    echo '<td>' . htmlspecialchars($result['date']) . '</td>';
                    echo '<td>' . htmlspecialchars($result['opponent']) . '</td>';
                    echo '<td>' . htmlspecialchars($result['score']) . '</td>';
                    echo '<td><span class="result-' . $result_class . '">' . htmlspecialchars($result['result']) . '</span></td>';
                    echo '</tr>';
                }
                ?>
            </tbody>
        </table>
    </div>
</section>
