<section id="single-athlete-page">
    <?php
    // Simulação de um banco de dados de atletas com detalhes
    $athletes = [
        [
            'id' => 1,
            'name' => 'Ana Silva',
            'position' => 'Levantadora',
            'image' => 'assets/images/placeholder_atleta_1.png',
            'height' => '1,75m',
            'birth_date' => '15/04/2007',
            'bio' => 'Ana é a capitã da equipe. Conhecida por sua visão de jogo e precisão nos levantamentos, ela é o cérebro do time em quadra.'
        ],
        [
            'id' => 2,
            'name' => 'Beatriz Costa',
            'position' => 'Ponteira',
            'image' => 'assets/images/placeholder_atleta_2.png',
            'height' => '1,80m',
            'birth_date' => '22/08/2007',
            'bio' => 'Com um ataque potente e um passe seguro, Beatriz é uma das principais pontuadoras da equipe e uma jogadora fundamental na recepção.'
        ],
        // Adicionando placeholders para os outros atletas para a lógica funcionar
        [ 'id' => 3, 'name' => 'Carla Mendes', 'position' => 'Central', 'image' => 'assets/images/placeholder_atleta_3.png', 'height' => '1,85m', 'birth_date' => '10/01/2007', 'bio' => 'Carla domina a rede com seus bloqueios e ataques rápidos.' ],
        [ 'id' => 4, 'name' => 'Daniela Oliveira', 'position' => 'Oposta', 'image' => 'assets/images/placeholder_atleta_4.png', 'height' => '1,82m', 'birth_date' => '30/11/2006', 'bio' => 'A canhota de ouro do time, Daniela tem um ataque poderoso da saída de rede.' ],
        [ 'id' => 5, 'name' => 'Eduarda Lima', 'position' => 'Líbero', 'image' => 'assets/images/placeholder_atleta_5.png', 'height' => '1,70m', 'birth_date' => '05/06/2007', 'bio' => 'Especialista em defesa, Eduarda é a segurança da nossa linha de passe.' ],
        [ 'id' => 6, 'name' => 'Fernanda Martins', 'position' => 'Ponteira', 'image' => 'assets/images/placeholder_atleta_6.png', 'height' => '1,78m', 'birth_date' => '19/02/2007', 'bio' => 'Fernanda é uma jogadora versátil, com ótimos fundamentos tanto no ataque quanto na defesa.' ]
    ];

    $athlete_found = null;
    if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        foreach ($athletes as $athlete) {
            if ($athlete['id'] === $id) {
                $athlete_found = $athlete;
                break;
            }
        }
    }

    if ($athlete_found) {
        echo '<div class="athlete-profile">';
        echo '<div class="athlete-profile-image">';
        echo '<img src="' . htmlspecialchars($athlete_found['image']) . '" alt="Foto de ' . htmlspecialchars($athlete_found['name']) . '">';
        echo '</div>';
        echo '<div class="athlete-profile-details">';
        echo '<h2>' . htmlspecialchars($athlete_found['name']) . '</h2>';
        echo '<ul>';
        echo '<li><strong>Posição:</strong> ' . htmlspecialchars($athlete_found['position']) . '</li>';
        echo '<li><strong>Altura:</strong> ' . htmlspecialchars($athlete_found['height']) . '</li>';
        echo '<li><strong>Data de Nascimento:</strong> ' . htmlspecialchars($athlete_found['birth_date']) . '</li>';
        echo '</ul>';
        echo '<p>' . htmlspecialchars($athlete_found['bio']) . '</p>';
        echo '<a href="index.php?page=atletas">&larr; Voltar para o time</a>';
        echo '</div>';
        echo '</div>';
    } else {
        echo '<h2>Atleta não encontrado</h2>';
        echo '<p>O perfil que você está procurando não foi encontrado. <a href="index.php?page=atletas">Voltar para a página do time</a>.</p>';
    }
    ?>
</section>
