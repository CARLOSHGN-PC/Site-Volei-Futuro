<section id="news-archive">
    <h2>Arquivo de Notícias</h2>

    <?php
    // Simulação de um banco de dados de posts
    $posts = [
        [
            'slug' => 'vitoria-no-campeonato-regional',
            'title' => 'Vitória no Campeonato Regional!',
            'date' => '05 de Setembro, 2024',
            'excerpt' => 'Nossa equipe sub-17 conquistou o título regional em um jogo emocionante contra o time da casa. A final foi decidida no tie-break, com uma virada espetacular no último set.'
        ],
        [
            'slug' => 'seletiva-aberta-para-novas-atletas',
            'title' => 'Seletiva Aberta para Novas Atletas',
            'date' => '01 de Setembro, 2024',
            'excerpt' => 'Estamos em busca de novos talentos para nossas equipes de base. As inscrições estão abertas até o final do mês para meninas de 14 a 18 anos. Venha fazer parte do Volei Futuro!'
        ],
        [
            'slug' => 'novo-uniforme-do-time',
            'title' => 'Volei Futuro Lança Novo Uniforme para a Temporada',
            'date' => '25 de Agosto, 2024',
            'excerpt' => 'Com um design moderno e tecnologia de ponta, o novo uniforme do Volei Futuro foi apresentado em um evento especial para patrocinadores e para a comunidade.'
        ]
    ];

    // Loop para exibir cada post
    foreach ($posts as $post) {
        echo '<article class="news-item">';
        echo '<h3><a href="index.php?page=single-post&slug=' . htmlspecialchars($post['slug']) . '">' . htmlspecialchars($post['title']) . '</a></h3>';
        echo '<p class="post-meta">Publicado em ' . htmlspecialchars($post['date']) . '</p>';
        echo '<p>' . htmlspecialchars($post['excerpt']) . '</p>';
        echo '<a href="index.php?page=single-post&slug=' . htmlspecialchars($post['slug']) . '" class="read-more">Leia mais &rarr;</a>';
        echo '</article>';
    }
    ?>

</section>
