<section id="team-page">
    <h2>Nosso Time Sub-17</h2>
    <p>Conheça as atletas que defendem as cores do Volei Futuro na temporada atual.</p>

    <div class="athlete-grid">
        <?php
        // Simulação de um banco de dados de atletas
        $athletes = [
            [
                'id' => 1,
                'name' => 'Ana Silva',
                'position' => 'Levantadora',
                'image' => 'assets/images/placeholder_atleta_1.png'
            ],
            [
                'id' => 2,
                'name' => 'Beatriz Costa',
                'position' => 'Ponteira',
                'image' => 'assets/images/placeholder_atleta_2.png'
            ],
            [
                'id' => 3,
                'name' => 'Carla Mendes',
                'position' => 'Central',
                'image' => 'assets/images/placeholder_atleta_3.png'
            ],
            [
                'id' => 4,
                'name' => 'Daniela Oliveira',
                'position' => 'Oposta',
                'image' => 'assets/images/placeholder_atleta_4.png'
            ],
            [
                'id' => 5,
                'name' => 'Eduarda Lima',
                'position' => 'Líbero',
                'image' => 'assets/images/placeholder_atleta_5.png'
            ],
            [
                'id' => 6,
                'name' => 'Fernanda Martins',
                'position' => 'Ponteira',
                'image' => 'assets/images/placeholder_atleta_6.png'
            ]
        ];

        // Loop para exibir cada atleta
        foreach ($athletes as $athlete) {
            echo '<div class="athlete-card">';
            // O link para o perfil individual será implementado a seguir
            echo '<a href="index.php?page=single-atleta&id=' . $athlete['id'] . '">';
            echo '<img src="' . htmlspecialchars($athlete['image']) . '" alt="Foto de ' . htmlspecialchars($athlete['name']) . '">';
            echo '<h3>' . htmlspecialchars($athlete['name']) . '</h3>';
            echo '<p class="position">' . htmlspecialchars($athlete['position']) . '</p>';
            echo '</a>';
            echo '</div>';
        }
        ?>
    </div>
</section>
